/**
 * Prompt add/edit page - shell-native implementation.
 *
 * Replaces web/pages/construct/prompt/[type]/index.tsx. Key changes:
 * - Route param `type` via React Router useParams instead of next/router.query.
 * - Edit handoff via navigate state instead of localStorage('edit_prompt_data').
 * - Server state via TanStack Query (targets, template, mutate add/update/verify).
 * - Theme via usePreferences (Zustand) instead of ChatContext.
 * - Model list via useUsableModels (TanStack Query) instead of ChatContext; the
 *   currently selected model name still comes from useModelsStore because it is
 *   cross-route client state (chat + prompt share the selection).
 * - Heavy deps (MarkdownEditor, JsonView, MarkdownContext) are lazy-loaded per
 *   ADR 0002 §阶段 2 so the edit route's chunk stays off the initial bundle.
 */

import useUser from '@/hooks/use-user';
import ModelIcon from '@/new-components/chat/content/ModelIcon';
import { DebugParams, OperatePromptParams } from '@/types/prompt';
import { getUserId } from '@/utils';
import { HEADER_USER_ID_KEY } from '@/utils/constants/index';
import { LeftOutlined } from '@ant-design/icons';
import { EventStreamContentType, fetchEventSource } from '@microsoft/fetch-event-source';
import { useModelsStore } from '@/app/stores';
import { Alert, App, Button, Card, Form, Input, InputNumber, Select, Slider, Space } from 'antd';
import classNames from 'classnames';
import MarkdownIt from 'markdown-it';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router';

import { usePreferences } from '~/store/preferences';
import { useUsableModels } from '~/features/construct-models/queries';
import { promptApi, PROMPT_DEBUG_ENDPOINT } from '~/features/construct-prompt/api';
import { useAddPrompt, useLlmOutVerify, usePromptTargets, useUpdatePrompt } from '~/features/construct-prompt/queries';

import 'react-markdown-editor-lite/lib/index.css';

// Heavy deps - lazy loaded so the edit route's chunk is split from the initial
// bundle (ADR 0002 §阶段 2).
const MarkdownEditor = lazy(() => import('react-markdown-editor-lite'));
const JsonView = lazy(() => import('@uiw/react-json-view'));
const MarkdownContext = lazy(() => import('@/new-components/common/MarkdownContext'));

// Themes are small static objects; importing them eagerly does not pull the
// full JsonView renderer into the initial chunk.
import { githubDarkTheme } from '@uiw/react-json-view/githubDark';
import { githubLightTheme } from '@uiw/react-json-view/githubLight';

const mdParser = new MarkdownIt();

const TypeOptions = [
  { value: 'Agent', label: 'AGENT' },
  { value: 'Scene', label: 'SCENE' },
  { value: 'Normal', label: 'NORMAL' },
  { value: 'Evaluate', label: 'EVALUATE' },
];

interface BottomFormValues {
  model?: string;
  temperature?: number;
  prompt_language?: 'en' | 'zh';
  user_input?: string;
}

interface TopFormValues {
  prompt_type: string;
  prompt_name: string;
  target: string;
  prompt_code?: string;
}

const TemperatureItem: React.FC<{
  value?: number;
  onChange?: (value: number) => void;
}> = ({ value, onChange }) => {
  const onTemperatureChange = (v: number | null) => {
    if (v == null || isNaN(v)) return;
    onChange?.(v);
  };
  return (
    <div className='flex items-center gap-8'>
      <Slider className='w-40' min={0} max={1} step={0.1} onChange={onTemperatureChange} value={value} />
      <InputNumber className='w-16' min={0} max={1} step={0.1} value={value} onChange={onTemperatureChange} />
    </div>
  );
};

interface PromptEditPageState {
  prompt?: OperatePromptParams & { prompt_code?: string };
}

export default function PromptEditPage() {
  const { type = '' } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { message } = App.useApp();

  const userInfo = useUser();
  const theme = usePreferences(s => s.theme);
  const isDark = theme === 'dark';
  const jsonTheme = isDark ? githubDarkTheme : githubLightTheme;
  const selectedModel = useModelsStore(s => s.model);
  const { data: modelList = [] } = useUsableModels();

  // Edit handoff: the list page passes the prompt via navigate state instead
  // of localStorage('edit_prompt_data'). Add mode has no state.
  const editData = (location.state as PromptEditPageState | null)?.prompt ?? null;

  // Markdown content + variables + response template
  const [value, setValue] = useState<string>('');
  const [variables, setVariables] = useState<string[]>([]);
  const [responseTemplate, setResponseTemplate] = useState<any>({});
  const [history, setHistory] = useState<Record<string, any>[]>([]);
  const [llmLoading, setLlmLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<{ msg: string; status: 'success' | 'error' } | undefined>();

  const [topForm] = Form.useForm<TopFormValues>();
  const [midForm] = Form.useForm();
  const [bottomForm] = Form.useForm<BottomFormValues>();

  const promptType = Form.useWatch('prompt_type', topForm);

  const modelOptions = useMemo(
    () =>
      modelList.map(item => ({
        value: item,
        label: (
          <div className='flex items-center'>
            <ModelIcon model={item} />
            <span className='ml-2'>{item}</span>
          </div>
        ),
      })),
    [modelList],
  );

  const onChange = useCallback((props: { text: string }) => {
    setValue(props.text);
  }, []);

  // --- Server state ---
  const { data: targetsData, isLoading: targetsLoading } = usePromptTargets(promptType);
  const addMutation = useAddPrompt();
  const updateMutation = useUpdatePrompt();
  const verifyMutation = useLlmOutVerify();

  const operateMutation = type === 'add' ? addMutation : updateMutation;
  const operateLoading = operateMutation.isPending;

  const targetOptions = useMemo(() => {
    return (targetsData ?? []).map(option => ({
      ...option,
      value: option.name,
      label: option.name,
    }));
  }, [targetsData]);

  // --- Effects ---

  // Default model from the cross-route selection (chat <-> prompt).
  useEffect(() => {
    if (selectedModel) {
      bottomForm.setFieldsValue({ model: selectedModel });
    }
  }, [bottomForm, selectedModel]);

  // Prefill form on edit mode from navigate state.
  useEffect(() => {
    if (type !== 'edit' || !editData) return;
    setVariables(JSON.parse(editData.input_variables ?? '[]'));
    setValue(editData.content);
    try {
      setResponseTemplate(editData.response_schema ? JSON.parse(editData.response_schema) : {});
    } catch {
      setResponseTemplate({});
    }
    topForm.setFieldsValue({
      prompt_type: editData.prompt_type,
      prompt_name: editData.prompt_name,
      prompt_code: editData.prompt_code,
      target: editData.chat_scene,
    });
    bottomForm.setFieldsValue({
      model: editData.model,
      prompt_language: editData.prompt_language as 'en' | 'zh' | undefined,
    });
  }, [type, editData]);

  // --- Handlers ---

  const handleTargetChange = async (target: string) => {
    if (!promptType || !target) return;
    try {
      const res = await promptApi.templateLoad({ prompt_type: promptType, target });
      setValue(res.template);
      setVariables(res.input_variables);
      try {
        setResponseTemplate(JSON.parse(res.response_format) || {});
      } catch {
        setResponseTemplate({});
      }
    } catch {
      // ignore template load errors; user can retry by reselecting
    }
  };

  const operateFn = () => {
    topForm.validateFields().then(async values => {
      const params: OperatePromptParams = {
        sub_chat_scene: '',
        model: bottomForm.getFieldValue('model'),
        chat_scene: values.target,
        prompt_name: values.prompt_name,
        prompt_type: values.prompt_type,
        content: value,
        response_schema: JSON.stringify(responseTemplate),
        input_variables: JSON.stringify(variables),
        prompt_language: bottomForm.getFieldValue('prompt_language'),
        prompt_desc: '',
        user_name: userInfo.nick_name,
        ...(type === 'edit' && { prompt_code: values.prompt_code }),
      };
      try {
        await operateMutation.mutateAsync(params);
        message.success(`${type === 'add' ? t('Add') : t('update')}${t('success')}`);
        navigate('/construct/prompt');
      } catch {
        // mutation error already surfaced by AntdApp message via defaultOnError
      }
    });
  };

  const onLLMTest = async () => {
    if (llmLoading) return;
    const midVals = midForm.getFieldsValue();
    if (!Object.values(midVals).every(v => !!v)) {
      message.warning(t('Please_complete_the_input_parameters'));
      return;
    }
    if (!bottomForm.getFieldValue('user_input')) {
      message.warning(t('Please_fill_in_the_user_input'));
      return;
    }
    topForm.validateFields().then(async values => {
      const params: DebugParams = {
        sub_chat_scene: '',
        model: bottomForm.getFieldValue('model'),
        chat_scene: values.target,
        prompt_name: values.prompt_name,
        prompt_type: values.prompt_type,
        content: value,
        response_schema: JSON.stringify(responseTemplate),
        input_variables: JSON.stringify(variables),
        prompt_language: bottomForm.getFieldValue('prompt_language'),
        prompt_desc: '',
        prompt_code: values.prompt_code ?? '',
        temperature: bottomForm.getFieldValue('temperature'),
        debug_model: bottomForm.getFieldValue('model'),
        input_values: { ...midVals },
        user_input: bottomForm.getFieldValue('user_input'),
      };
      const tempHistory: Record<string, any>[] = [{ role: 'view', context: '' }];
      const index = tempHistory.length - 1;
      try {
        setLlmLoading(true);
        await fetchEventSource(`${import.meta.env.VITE_API_BASE_URL ?? ''}${PROMPT_DEBUG_ENDPOINT}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            [HEADER_USER_ID_KEY]: getUserId() ?? '',
          },
          body: JSON.stringify(params),
          openWhenHidden: true,
          async onopen(response) {
            if (response.ok && response.headers.get('content-type') === EventStreamContentType) {
              return;
            }
          },
          onclose() {
            setLlmLoading(false);
          },
          onerror(err) {
            throw new Error(String(err));
          },
          onmessage: event => {
            let msg = event.data;
            if (!msg) return;
            try {
              msg = JSON.parse(msg).vis;
            } catch {
              msg = msg.replaceAll('\\n', '\n');
            }
            if (msg === '[DONE]') {
              setLlmLoading(false);
            } else if (msg?.startsWith('[ERROR]')) {
              setLlmLoading(false);
              tempHistory[index]!.context = msg.replace('[ERROR]', '');
              setHistory([...tempHistory]);
            } else {
              tempHistory[index]!.context = msg;
              setHistory([...tempHistory]);
            }
          },
        });
      } catch {
        setLlmLoading(false);
        tempHistory[index]!.context = 'Sorry, we meet some error, please try again later';
        setHistory([...tempHistory]);
      }
    });
  };

  const onVerify = async () => {
    if (verifyMutation.isPending || !history[0]?.context) return;
    try {
      const res = await verifyMutation.mutateAsync({
        llm_out: history[0]!.context,
        prompt_type: topForm.getFieldValue('prompt_type'),
        chat_scene: topForm.getFieldValue('target'),
      });
      if (res?.success) {
        setErrorMessage({ msg: '验证通过', status: 'success' });
      } else {
        setErrorMessage({ msg: res?.err_msg ?? '验证失败', status: 'error' });
      }
    } catch {
      setErrorMessage({ msg: '验证失败', status: 'error' });
    }
  };

  return (
    <div className='prompt-operate-container flex flex-col w-full h-full justify-between dark:bg-gradient-dark'>
      <header className='flex items-center justify-between px-6 py-2 h-14 border-b border-[#edeeef]'>
        <Space className='flex items-center'>
          <LeftOutlined
            className='text-base cursor-pointer hover:text-[#0c75fc]'
            onClick={() => navigate('/construct/prompt')}
          />
          <span className='font-medium text-sm'>{type === 'add' ? t('Add') : t('Edit')} Prompt</span>
        </Space>
        <Space>
          <Button type='primary' onClick={operateFn} loading={operateLoading}>
            {type === 'add' ? t('save') : t('update')}
          </Button>
        </Space>
      </header>
      <section className='flex h-full p-4 gap-4'>
        {/* Editor area */}
        <div className='flex flex-col flex-1 h-full overflow-y-auto pb-8'>
          <Suspense fallback={null}>
            <MarkdownEditor value={value} onChange={onChange} renderHTML={(text: string) => mdParser.render(text)} view={{ html: false, md: true, menu: true }} />
          </Suspense>
          {history.length > 0 && (
            <Card
              title={
                <Space>
                  <span>LLM OUT</span>
                  {errorMessage && <Alert message={errorMessage.msg} type={errorMessage.status} showIcon />}
                </Space>
              }
              className='mt-2'
            >
              <div className='max-h-[400px] overflow-y-auto'>
                <Suspense fallback={null}>
                  <MarkdownContext>{history[0]?.context.replace(/\\n/gm, '\n')}</MarkdownContext>
                </Suspense>
              </div>
            </Card>
          )}
        </div>
        {/* Controls area */}
        <div className='flex flex-col w-2/5 pb-8 overflow-y-auto'>
          <Card className='mb-4'>
            <Form form={topForm}>
              <div className='flex w-full gap-1 justify-between'>
                <Form.Item label='Type' name='prompt_type' className='w-2/5' rules={[{ required: true, message: t('select_type') }]}>
                  <Select options={TypeOptions} placeholder={t('select_type')} allowClear />
                </Form.Item>
                <Form.Item name='target' className='w-3/5' rules={[{ required: true, message: t('select_scene') }]}>
                  <Select loading={targetsLoading} placeholder={t('select_scene')} allowClear showSearch onChange={handleTargetChange}>
                    {targetOptions.map(option => (
                      <Select.Option key={option.value} title={option.desc}>
                        {option.label}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </div>
              {type === 'edit' && (
                <Form.Item label='Code' name='prompt_code'>
                  <Input disabled />
                </Form.Item>
              )}
              <Form.Item label='Name' name='prompt_name' className='m-0' rules={[{ required: true, message: t('Please_input_prompt_name') }]}>
                <Input placeholder={t('Please_input_prompt_name')} />
              </Form.Item>
            </Form>
          </Card>
          <Card title={t('input_parameter')} className='mb-4'>
            <Form form={midForm}>
              {variables
                .filter(item => item !== 'out_schema')
                .map(item => (
                  <Form.Item key={item} label={item} name={item} rules={[{ message: `${t('Please_Input')}${item}` }]}>
                    <Input placeholder={t('Please_Input')} />
                  </Form.Item>
                ))}
            </Form>
          </Card>
          <Card title={t('output_structure')} className='flex flex-col flex-1'>
            <Suspense fallback={null}>
              <JsonView
                style={{ ...jsonTheme, width: '100%', padding: 4 }}
                className={classNames({ 'bg-[#fafafa]': !isDark })}
                value={responseTemplate}
                enableClipboard={false}
                displayDataTypes={false}
                objectSortKeys={false}
              />
            </Suspense>
            <div className='flex flex-col mt-4'>
              <Form form={bottomForm} initialValues={{ model: selectedModel, temperature: 0.5, prompt_language: 'en' }}>
                <Form.Item label={t('model')} name='model'>
                  <Select className='h-8 rounded-3xl' options={modelOptions} allowClear showSearch />
                </Form.Item>
                <Form.Item label={t('temperature')} name='temperature'>
                  <TemperatureItem />
                </Form.Item>
                <Form.Item label={t('language')} name='prompt_language'>
                  <Select
                    options={[
                      { label: t('English'), value: 'en' },
                      { label: t('Chinese'), value: 'zh' },
                    ]}
                  />
                </Form.Item>
                <Form.Item label={t('User_input')} name='user_input'>
                  <Input placeholder={t('Please_Input')} />
                </Form.Item>
              </Form>
            </div>
            <Space className='flex justify-between'>
              <Button type='primary' onClick={onLLMTest} loading={llmLoading}>
                {t('LLM_test')}
              </Button>
              <Button type='primary' onClick={onVerify} loading={verifyMutation.isPending}>
                {t('Output_verification')}
              </Button>
            </Space>
          </Card>
        </div>
      </section>
    </div>
  );
}

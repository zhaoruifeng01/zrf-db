import type { MetaDescriptor } from 'react-router';

import PromptEditPage from '~/features/construct-prompt/pages/PromptEditPage';

export function meta(): MetaDescriptor[] {
  return [{ title: 'DB-GPT · Prompt' }];
}

/**
 * /construct/prompt/:type - add/edit prompt. The :type param ('add' | 'edit')
 * is read by PromptEditPage via useParams. Edit mode also expects the prompt
 * row to be passed via navigate state (see PromptListPage.handleEdit).
 */
export default function ConstructPromptTypeRoute() {
  return <PromptEditPage />;
}

import type { MetaDescriptor } from 'react-router';

import PromptListPage from '~/features/construct-prompt/pages/PromptListPage';

export function meta(): MetaDescriptor[] {
  return [{ title: 'DB-GPT · Prompt' }];
}

export default function ConstructPromptRoute() {
  return <PromptListPage />;
}

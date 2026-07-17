import type { MetaDescriptor } from 'react-router';

import ModelsPage from '~/features/construct-models/pages/ModelsPage';

export function meta(): MetaDescriptor[] {
  return [{ title: 'DB-GPT · Models' }];
}

export default function ConstructModelsRoute() {
  return <ModelsPage />;
}

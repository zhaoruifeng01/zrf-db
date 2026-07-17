/**
 * Centralized dayjs wrapper.
 *
 * Pre-configured with the plugins and locales used across the app, so callers
 * can just `import { dayjs } from '@/utils/date'` without repeating the
 * plugin/locale boilerplate. Replaces moment.js per ADR 0001 §长期.
 */

import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

export { dayjs };
export default dayjs;

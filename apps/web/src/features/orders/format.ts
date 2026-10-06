const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const shortDate = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
const dateTime = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** "6 Oct 2026" */
export const formatDate = (iso: string) => dateFormat.format(new Date(iso));
/** "14 Oct" */
export const formatShortDate = (iso: string) => shortDate.format(new Date(iso));
/** "6 Oct, 3:30 pm" */
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));

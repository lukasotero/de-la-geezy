import { format } from 'date-fns'

export const todayLocal = () => format(new Date(), 'yyyy-MM-dd')

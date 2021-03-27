import { List, Record, Set } from 'immutable'
import { assertUnreachable } from '../../common/assert-unreachable'
import { EMAIL_VERIFICATION_ID, Notification, NotificationType } from '../../common/notifications'
import keyedReducer from '../reducers/keyed-reducer'

export interface NotificationRecordBase {
  type: NotificationType
  /**
   * A string that is unique if the notification is unique. For locally-generated notifications
   * that should never show duplicates, this might be a constant string. For server-generated ones
   * that have multiple of the same type (e.g. chat notifications, party invites, etc.) these are
   * generated by the server.
   */
  id: string
  unread: boolean
}

export class EmailVerificationNotificationRecord
  extends Record({
    type: NotificationType.EmailVerification as typeof NotificationType.EmailVerification,
    id: EMAIL_VERIFICATION_ID,
    unread: true,
  })
  implements NotificationRecordBase {}

export type NotificationRecord = EmailVerificationNotificationRecord

function toNotificationRecord(notification: Readonly<Notification>): NotificationRecord {
  switch (notification.type) {
    case NotificationType.EmailVerification:
      return new EmailVerificationNotificationRecord(notification)
    default:
      return assertUnreachable(notification.type)
  }
}

export class NotificationState extends Record({
  list: List<NotificationRecord>(),
  ids: Set<string>(),
}) {}

export default keyedReducer(new NotificationState(), {
  ['@notifications/add'](state, { payload: { notification } }) {
    if (state.ids.has(notification.id)) {
      return state
    }

    return state
      .update('list', l => l.unshift(toNotificationRecord(notification)))
      .update('ids', s => s.add(notification.id))
  },

  ['@notifications/clear'](state) {
    return state.set('list', List()).set('ids', Set())
  },

  ['@notifications/markRead'](state) {
    return state.update('list', l => l.map(n => n.set('unread', false)))
  },
})
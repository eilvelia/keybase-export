// @flow

export type CleanedMessage = {
  id: number,
  text?: string,
  attachment?: {
    path: string,
    asset_type: number
  },
  sent_at: number,
  sender_uid: string,
  sender_username?: string,
  device_id: string,
  device_name?: string,
  revoked_device?: boolean
}

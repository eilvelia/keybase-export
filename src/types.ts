export type CleanedMessage = {
  id: number,
  text?: string,
  reply_to?: number,
  attachment?: {
    path: string,
    asset_type: string
  },
  sent_at: number,
  sender_uid: string,
  sender_username?: string,
  device_id: string,
  device_name?: string,
  revoked_device?: boolean
}

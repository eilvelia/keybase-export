export type CleanedMessage = {
  text?: string,
  id: number,
  reactions?: {
    [key: string]: {
      [key: string]: { ctime: number, reactionMsgId: number }
    }
  },
  reply_to?: number,
  attachment?: {
    path: string,
    asset_type: string
  },
  sent_at: number,
  sent_at_ms: number,
  edited?: true,
  sender_username?: string,
  sender_uid: string,
  device_id: string,
  device_name?: string,
  system?: true,
  special?: true,
}

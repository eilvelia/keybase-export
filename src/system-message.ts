import Debug from 'debug'
import { warn } from './log'

import * as chat1 from 'keybase-bot/lib/types/chat1'
import * as keybase1 from 'keybase-bot/lib/types/keybase1'

const debug = Debug('keybase-export:system-message')

// (Works correctly only for integer days / hours, which is the case here)
function humanizeDuration (seconds: number): string {
  const plural = (x: number) => x === 1 ? '' : 's'
  const minutes = seconds / 60
  const hours = minutes / 60
  const days = hours / 24
  if (days >= 1) return `${days} day${plural(days)}`
  if (hours >= 1) return `${hours} hour${plural(hours)}`
  return `${seconds} second${plural(seconds)}`
}

function convertRole (role: keybase1.TeamRole): string {
  switch (role as keybase1.TeamRole | number) {
    case 0:
    case keybase1.TeamRole.NONE:
      return ''
    case 1:
    case keybase1.TeamRole.READER:
      return ' as reader'
    case 2:
    case keybase1.TeamRole.WRITER:
      return ' as writer'
    case 3:
    case keybase1.TeamRole.ADMIN:
      return ' as admin'
    case 4:
    case keybase1.TeamRole.OWNER:
      return ' as owner'
    case 5:
    case keybase1.TeamRole.BOT:
      return ' as bot'
    case 6:
    case keybase1.TeamRole.RESTRICTEDBOT:
      return ' as restricted bot'
    default:
      warn(role)
      return ' as <unknown>'
  }
}

// https://github.com/keybase/client/blob/a66861b2e521fe78b9f426e9a1af4c7ab7bd537b/go/protocol/chat1/extras.go#L3024
export function convertSystemMessage (msgInput: chat1.MessageSystem): string {
  const msg: any = msgInput
  debug('System message', msg)
  // The TypeScript types tell that values are strings like "addedtoteam",
  // but the Keybase client actually sends numbers
  // https://github.com/keybase/client/blob/a66861b2e521fe78b9f426e9a1af4c7ab7bd537b/go/protocol/chat1/local.go#L434
  switch (msg.systemType as chat1.MessageSystemType | number) {
    case 0:
    case chat1.MessageSystemType.ADDEDTOTEAM: {
      const { team, adder, addee, role }: chat1.MessageSystemAddedToTeam = msg.addedtoteam
      const asRole = convertRole(role)
      return `${adder} added ${addee} to the team ${team}${asRole}`
    }
    case 1:
    case chat1.MessageSystemType.INVITEADDEDTOTEAM: {
      const { team, adder, inviter, invitee, role }: chat1.MessageSystemInviteAddedToTeam = msg.inviteaddedtoteam
      const asRole = convertRole(role)
      return `${adder} added ${invitee} to the team ${team}${asRole} (invited by ${inviter})`
    }
    case 2:
    case chat1.MessageSystemType.COMPLEXTEAM: {
      const { team }: chat1.MessageSystemComplexTeam = msg.complexteam
      return `${team} is now a 'big' team with multiple channels`
    }
    case 3:
    case chat1.MessageSystemType.CREATETEAM: {
      const { creator, team }: chat1.MessageSystemCreateTeam = msg.createteam
      return `${creator} created the team ${team}`
    }
    case 4:
    case chat1.MessageSystemType.GITPUSH: {
      const {
        team, pusher, repoName, /* repoId, */
        refs, pushType, previousRepoName
      }: chat1.MessageSystemGitPush = msg.gitpush
      switch (pushType as keybase1.GitPushType | number) {
        case 1:
        case keybase1.GitPushType.CREATEREPO:
          return `git (${repoName}): ${pusher} created the repo in the team ${team}`
        case 3:
        case keybase1.GitPushType.RENAMEREPO:
          return `git (${repoName}) ${pusher} changed the repo name from ${previousRepoName}`
        case 0:
        case keybase1.GitPushType.DEFAULT:
          const total = refs?.reduce((a, x) => (x.commits?.length ?? 0) + a, 0) ?? 0
          const names = refs?.map(x => x.refName).join(',') ?? ''
          return `git (${repoName}): ${pusher} pushed ${total} commits to ${names}`
        default: warn(msg.gitpush)
      }
    }
    case 5:
    case chat1.MessageSystemType.CHANGEAVATAR: {
      const { team, user }: chat1.MessageSystemChangeAvatar = msg.changeavatar
      return `${user} changed team avatar of ${team}`
    }
    case 6:
    case chat1.MessageSystemType.CHANGERETENTION: {
      const { isTeam, isInherit, /* membersType, */ policy, user }: chat1.MessageSystemChangeRetention
        = msg.changeretention
      const appliesTo = isTeam ? 'team' : 'channel'
      const inherit = isInherit ? ' to inherit from the team policy' : ''
      const summary = (function () {
        switch (policy.typ as chat1.RetentionPolicyType | number) {
          case 0:
          case 1:
          case chat1.RetentionPolicyType.NONE:
          case chat1.RetentionPolicyType.RETAIN:
            return ' Messages will be retained indefinitely.'
          case 2:
          case chat1.RetentionPolicyType.EXPIRE:
            return ` Messages will expire after ${humanizeDuration((policy as any).expire.age)}.`
          case 3:
          case chat1.RetentionPolicyType.INHERIT:
            return ''
          case 4:
          case chat1.RetentionPolicyType.EPHEMERAL:
            return ` Messages will explode after ${humanizeDuration((policy as any).ephemeral.age)}.`
        }
      }())
      return `${user} changed the ${appliesTo} retention policy${inherit}.${summary}`
    }
    case 7:
    case chat1.MessageSystemType.BULKADDTOCONV: {
      const { usernames }: chat1.MessageSystemBulkAddToConv = msg.bulkaddtoconv
      const usernamesStr = usernames?.join(', ') ?? '<NULL>'
      return `added ${usernamesStr} to the conversation`
    }
    case 8:
    case chat1.MessageSystemType.SBSRESOLVE: {
      const { assertionService, assertionUsername, prover }: chat1.MessageSystemSbsResolve = msg.sbsresolve
      switch (assertionService) {
        case 'phone':
          return `${prover} verified their phone number ${assertionUsername} and joined the conversation`
        case 'email':
          return `${prover} verified their email address ${assertionUsername} and joined the conversation`
      }
      return `${prover} proved they are ${assertionUsername} on ${assertionService} and joined the conversation`
    }
    case 9: { // NEWCHANNEL
      const { creator, nameAtCreation, convIDs } = msg.newchannel
      if (convIDs && convIDs > 1)
        return `${creator} created #${nameAtCreation} and ${convIDs-1} other new channels`
      return `${creator} created a new channel #${nameAtCreation}`
    }
    default:
      return `System message: unknown (${(msg as chat1.MessageSystem).systemType})`
  }
}

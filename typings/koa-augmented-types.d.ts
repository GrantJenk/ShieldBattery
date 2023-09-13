import { Logger } from 'pino'
import promClient from 'prom-client'
import { MatchmakingType } from '../common/matchmaking'
import { SbPermissions } from '../common/users/permissions'
import { SelfUser } from '../common/users/sb-user'

declare module 'koa' {
  interface LoggedInAppSession {
    user: SelfUser
    permissions: SbPermissions
    lastQueuedMatchmakingType: MatchmakingType
  }

  interface LoggedOutAppSession {
    user?: undefined
    permissions?: undefined
    lastQueuedMatchmakingType?: undefined
  }

  type AppSession = {
    cookie: any // TODO(tec27): Type this better, this is how koa-generic-session types it as well
  } & (LoggedInAppSession | LoggedOutAppSession)

  // NOTE(tec27): We add a bunch of things to ExtendedContext so that koa-router's more generic
  // Context extension stuff doesn't get broken by these libraries' more direct way of just
  // extending the final `Context` type (and make TS complain about these properties missing on
  // `RouterContext`)
  interface ExtendableContext {
    // for koa-generic-session
    session: AppSession | null
    sessionId: string | null
    sessionSave: boolean | null
    regenerateSession(): Promise<void>

    // for koa-views
    render(viewPath: string, locals?: any): Promise<void>

    /**
     * Marks that this request as not needing session cookies. This should generally be used on
     * things like EventSource routes where we need to flush headers prior to the session middleware
     * getting to save.
     */
    dontSendSessionCookies: boolean | undefined

    // For Prometheus additions
    prometheus: typeof promClient

    // From koa-pino-logger
    log: Logger
  }
}

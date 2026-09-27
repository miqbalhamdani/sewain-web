import { ReactComponentElement } from 'react'

export interface IRoute {
  name: string
  path: string
  icon: ReactComponentElement | string

  /**
   * The permission this navigation entry needs, from `/me`.
   *
   * Absent means everybody sees it. When set, the sidebar does not render the
   * entry at all for a role that lacks it — BR-003 wants the action gone, not
   * greyed out: a disabled control advertises a capability the user does not
   * have and turns into a support question.
   */
  permission?: string

  secondary?: boolean
}

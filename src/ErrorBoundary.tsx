import { Component } from 'react'
import type { ReactNode } from 'react'

/** Shows `fallback` instead of a blank page when something below it fails to load or render. */
export default class ErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

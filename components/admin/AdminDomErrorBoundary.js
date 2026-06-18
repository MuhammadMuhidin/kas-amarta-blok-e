"use client";

import { Component } from "react";

export default class AdminDomErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    if (typeof error?.message === "string" && error.message.includes("removeChild")) {
      // DOM reconciliation error — ignore silently, the UI will recover on next render
      this.setState({ hasError: false });
      return;
    }
    console.error("Admin DOM error:", error);
    this.setState({ hasError: false });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }
    return this.props.children;
  }
}

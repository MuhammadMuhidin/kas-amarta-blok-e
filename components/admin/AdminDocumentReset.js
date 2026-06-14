"use client";

import { useLayoutEffect } from "react";

const RESET_PROPERTIES = ["height", "overflow", "overscroll-behavior", "background", "background-color"];

function readInlineStyles(element) {
  return RESET_PROPERTIES.map((property) => ({
    property,
    value: element.style.getPropertyValue(property),
    priority: element.style.getPropertyPriority(property),
  }));
}

function restoreInlineStyles(element, styles) {
  styles.forEach(({ property, value, priority }) => {
    if (value) element.style.setProperty(property, value, priority);
    else element.style.removeProperty(property);
  });
}

export default function AdminDocumentReset() {
  useLayoutEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlStyles = readInlineStyles(html);
    const previousBodyStyles = readInlineStyles(body);

    html.style.setProperty("height", "auto", "important");
    html.style.setProperty("overflow", "auto", "important");
    html.style.setProperty("overscroll-behavior", "auto", "important");
    html.style.setProperty("background-color", "var(--admin-bg)", "important");

    body.style.setProperty("height", "auto", "important");
    body.style.setProperty("overflow", "auto", "important");
    body.style.setProperty("overscroll-behavior", "auto", "important");
    body.style.setProperty("background-color", "var(--admin-bg)", "important");
    body.classList.remove("login-whatsapp-disabled-active");

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    return () => {
      restoreInlineStyles(html, previousHtmlStyles);
      restoreInlineStyles(body, previousBodyStyles);
    };
  }, []);

  return null;
}

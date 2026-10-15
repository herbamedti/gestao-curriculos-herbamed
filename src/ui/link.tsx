'use client';
import NextLink from 'next/link';
import type { ComponentProps } from 'react';
import { LinkFeedback } from './pending-feedback';
import { Children, Fragment, isValidElement, type ReactNode } from 'react';

function textLabels(children: ReactNode): ReactNode {
  return Children.map(children, child => {
    if (typeof child === 'string' || typeof child === 'number') return <span className="link-label">{child}</span>;
    if (isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment) return <Fragment>{textLabels(child.props.children)}</Fragment>;
    return child;
  });
}

export default function Link({
  children,
  className = '',
  ...props
}: ComponentProps<typeof NextLink>) {
  return (
    <NextLink {...props} className={`feedback-link ${className}`}>
      {className.split(/\s+/).includes('text-link') ? textLabels(children) : children}
      <LinkFeedback />
    </NextLink>
  );
}

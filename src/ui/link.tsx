'use client';
import NextLink from 'next/link';
import type { ComponentProps } from 'react';
import { LinkFeedback } from './pending-feedback';

export default function Link({
  children,
  className = '',
  ...props
}: ComponentProps<typeof NextLink>) {
  return (
    <NextLink {...props} className={`feedback-link ${className}`}>
      {children}
      <LinkFeedback />
    </NextLink>
  );
}

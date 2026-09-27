import React, { ReactNode } from 'react';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // dir is set here, server-side. Setting it from a layout at runtime made
    // the client add an attribute the server never sent — a hydration mismatch.
    <html lang="id" dir="ltr">
      <body id={'root'}>{children}</body>
    </html>
  );
}

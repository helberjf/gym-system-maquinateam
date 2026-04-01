"use client";

import { BRAND } from "@/lib/constants/brand";

export function WhatsAppButton() {
  return (
    <a
      href={BRAND.contact.whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Fale conosco pelo WhatsApp"
      className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-105 hover:shadow-xl sm:h-16 sm:w-16"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 32 32"
        fill="currentColor"
        className="h-7 w-7 sm:h-8 sm:w-8"
      >
        <path d="M16.004 0h-.008C7.174 0 0 7.176 0 16.004c0 3.502 1.14 6.746 3.072 9.382L1.062 31.17l5.964-1.97A15.9 15.9 0 0016.004 32C24.826 32 32 24.826 32 16.004S24.826 0 16.004 0zm9.314 22.598c-.39 1.1-1.932 2.014-3.168 2.28-.846.18-1.95.324-5.67-1.218-4.762-1.972-7.824-6.81-8.062-7.124-.228-.314-1.92-2.556-1.92-4.876s1.214-3.458 1.644-3.932c.43-.474.94-.592 1.252-.592.312 0 .624.002.898.016.288.016.674-.11 1.054.804.39.94 1.328 3.244 1.446 3.478.118.234.196.508.038.82-.156.312-.234.508-.468.782-.234.274-.492.612-.702.822-.234.234-.478.488-.206.958.274.468 1.216 2.006 2.61 3.25 1.792 1.598 3.302 2.094 3.772 2.328.468.234.742.196 1.016-.118.274-.314 1.176-1.37 1.488-1.842.312-.468.624-.39 1.054-.234.43.156 2.734 1.29 3.202 1.524.468.234.782.352.898.546.118.196.118 1.1-.272 2.198z" />
      </svg>
    </a>
  );
}

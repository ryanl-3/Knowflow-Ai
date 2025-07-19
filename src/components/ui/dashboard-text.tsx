'use client';

import { useTranslation } from '@/lib/i18n';

export function YourProjectsText() {
  const { t } = useTranslation();
  return t('dashboard.yourProjects');
}

export function NoProjectsYetText() {
  const { t } = useTranslation();
  return t('dashboard.noProjectsYet');
}

export function CreateFirstProjectText() {
  const { t } = useTranslation();
  return t('dashboard.createFirstProject');
}

export function PreviousText() {
  const { t } = useTranslation();
  return t('dashboard.previous');
}

export function NextText() {
  const { t } = useTranslation();
  return t('dashboard.next');
}

export function PageOfText({ current, total }: { current: number; total: number }) {
  const { t } = useTranslation();
  return t('dashboard.pageOf').replace('{current}', current.toString()).replace('{total}', total.toString());
} 
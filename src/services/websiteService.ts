import { Types } from 'mongoose';
import WebsiteConfig, { type WebsiteConfigValue } from '../models/WebsiteConfig';
import { IUser } from '../models/User';

export const defaultWebsiteConfig = (): WebsiteConfigValue => ({
  branding: {
    primaryColor: '#111111',
    accentColor: '#c59d5f',
    backgroundColor: '#f7f4ef',
    textColor: '#171717',
  },
  hero: {
    eyebrow: 'WELCOME',
    title: 'Quality service, made easy to book.',
    description: 'Explore our services, choose a branch, and reserve your preferred schedule online.',
    cardLabel: 'ONLINE RESERVATIONS',
    cardTitle: 'Choose your service.\\nPick your schedule.',
    backgroundImageUrl: '',
  },
  bookingCta: {
    enabled: true,
    label: 'Book an appointment',
    mode: 'modal',
  },
  sections: {
    services: { enabled: true, eyebrow: 'OUR SERVICES', title: 'Services & pricing' },
    branches: { enabled: true, eyebrow: 'LOCATIONS', title: 'Visit us' },
    contact: { enabled: true, eyebrow: 'GET IN TOUCH', title: 'Ready when you are.' },
  },
  footer: { poweredByText: 'Powered by DoyBiz' },
});

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const normalizeColor = (value: unknown, fallback: string) =>
  typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.trim())
    ? value.trim()
    : fallback;

const normalizeText = (value: unknown, fallback: string, max = 500) =>
  typeof value === 'string' ? value.trim().slice(0, max) : fallback;

const normalizeConfig = (input: any, base: WebsiteConfigValue): WebsiteConfigValue => ({
  branding: {
    primaryColor: normalizeColor(input?.branding?.primaryColor, base.branding.primaryColor),
    accentColor: normalizeColor(input?.branding?.accentColor, base.branding.accentColor),
    backgroundColor: normalizeColor(input?.branding?.backgroundColor, base.branding.backgroundColor),
    textColor: normalizeColor(input?.branding?.textColor, base.branding.textColor),
  },
  hero: {
    eyebrow: normalizeText(input?.hero?.eyebrow, base.hero.eyebrow, 80),
    title: normalizeText(input?.hero?.title, base.hero.title, 160),
    description: normalizeText(input?.hero?.description, base.hero.description, 500),
    cardLabel: normalizeText(input?.hero?.cardLabel, base.hero.cardLabel, 80),
    cardTitle: normalizeText(input?.hero?.cardTitle, base.hero.cardTitle, 160),
    backgroundImageUrl: normalizeText(input?.hero?.backgroundImageUrl, base.hero.backgroundImageUrl, 1000),
  },
  bookingCta: {
    enabled: input?.bookingCta?.enabled !== false,
    label: normalizeText(input?.bookingCta?.label, base.bookingCta.label, 80),
    mode: input?.bookingCta?.mode === 'page' ? 'page' : 'modal',
  },
  sections: {
    services: {
      enabled: input?.sections?.services?.enabled !== false,
      eyebrow: normalizeText(input?.sections?.services?.eyebrow, base.sections.services.eyebrow, 80),
      title: normalizeText(input?.sections?.services?.title, base.sections.services.title, 120),
    },
    branches: {
      enabled: input?.sections?.branches?.enabled !== false,
      eyebrow: normalizeText(input?.sections?.branches?.eyebrow, base.sections.branches.eyebrow, 80),
      title: normalizeText(input?.sections?.branches?.title, base.sections.branches.title, 120),
    },
    contact: {
      enabled: input?.sections?.contact?.enabled !== false,
      eyebrow: normalizeText(input?.sections?.contact?.eyebrow, base.sections.contact.eyebrow, 80),
      title: normalizeText(input?.sections?.contact?.title, base.sections.contact.title, 120),
    },
  },
  footer: {
    poweredByText: normalizeText(input?.footer?.poweredByText, base.footer.poweredByText, 120),
  },
});

export const getWebsiteConfig = async (user: IUser) => {
  let config = await WebsiteConfig.findOne({ organizationId: user.organizationId });
  if (!config) {
    const defaults = defaultWebsiteConfig();
    config = await WebsiteConfig.create({ organizationId: user.organizationId, draft: defaults, published: defaults, publishedAt: new Date() });
  }
  return config;
};

export const updateWebsiteDraft = async (data: any, user: IUser) => {
  const current = await getWebsiteConfig(user);
  const base = clone(current.draft || defaultWebsiteConfig());
  current.draft = normalizeConfig(data, base) as any;
  await current.save();
  return current;
};

export const publishWebsite = async (user: IUser) => {
  const current = await getWebsiteConfig(user);
  current.published = clone(current.draft) as any;
  current.publishedAt = new Date();
  await current.save();
  return current;
};

export const getPublicWebsiteConfig = async (organizationId: Types.ObjectId) => {
  const config = await WebsiteConfig.findOne({ organizationId }).select('published');
  return config?.published || defaultWebsiteConfig();
};

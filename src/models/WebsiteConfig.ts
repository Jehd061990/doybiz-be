import mongoose, { Document, Schema, Types } from 'mongoose';

export type WebsiteTemplateKey = 'CLASSIC' | 'MODERN_LUXURY' | 'MINIMAL_MODERN';
export const DEFAULT_WEBSITE_TEMPLATE: WebsiteTemplateKey = 'CLASSIC';
export type WebsiteSectionKey = 'HERO' | 'SERVICES' | 'BRANCHES' | 'CONTACT';
export const DEFAULT_WEBSITE_SECTION_ORDER: WebsiteSectionKey[] = ['HERO', 'SERVICES', 'BRANCHES', 'CONTACT'];
export type BookingCtaMode = 'modal' | 'page';
export type WebsiteLogoShape = 'circle' | 'square' | 'heart' | 'star';
export type WebsiteLogoSize = 'small' | 'medium' | 'large' | 'xlarge';
export type WebsiteBrandLayout = 'horizontal' | 'vertical';

export interface WebsiteTemplateSettings {
  classic: {
    heroAlignment: 'left' | 'center';
    navigationStyle: 'standard' | 'minimal';
    sectionSpacing: 'comfortable' | 'compact';
    heroImagePosition: 'center' | 'top' | 'bottom';
    ctaStyle: 'solid' | 'outline';
  };
  modernLuxury: {
    heroComposition: 'full-bleed' | 'split';
    navigationStyle: 'editorial' | 'minimal';
    sectionSpacing: 'airy' | 'compact';
    imageTreatment: 'natural' | 'cinematic';
    overlayIntensity: 'soft' | 'strong';
    showHeroBadge: boolean;
  };
  minimalModern: {
    heroAlignment: 'left' | 'center';
    navigationStyle: 'minimal' | 'standard';
    sectionSpacing: 'airy' | 'compact';
    heroImagePosition: 'left' | 'right';
    ctaStyle: 'solid' | 'outline';
  };
}

export const DEFAULT_WEBSITE_TEMPLATE_SETTINGS: WebsiteTemplateSettings = {
  classic: {
    heroAlignment: 'left',
    navigationStyle: 'standard',
    sectionSpacing: 'comfortable',
    heroImagePosition: 'center',
    ctaStyle: 'solid',
  },
  modernLuxury: {
    heroComposition: 'full-bleed',
    navigationStyle: 'editorial',
    sectionSpacing: 'airy',
    imageTreatment: 'natural',
    overlayIntensity: 'strong',
    showHeroBadge: true,
  },
  minimalModern: {
    heroAlignment: 'left',
    navigationStyle: 'minimal',
    sectionSpacing: 'airy',
    heroImagePosition: 'right',
    ctaStyle: 'solid',
  },
};

export interface WebsiteConfigValue {
  template: WebsiteTemplateKey;
  templateSettings: WebsiteTemplateSettings;
  branding: {
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
    textColor: string;
    logoUrl: string;
    brandDisplay: 'text' | 'logo' | 'both' | 'none';
    logoShape: WebsiteLogoShape;
    logoSize: WebsiteLogoSize;
    brandLayout: WebsiteBrandLayout;
  };
  hero: {
    eyebrow: string;
    title: string;
    description: string;
    cardLabel: string;
    cardTitle: string;
    backgroundImageUrl: string;
  };
  sectionOrder: WebsiteSectionKey[];
  bookingCta: {
    enabled: boolean;
    label: string;
    mode: BookingCtaMode;
  };
  sections: {
    services: { enabled: boolean; eyebrow: string; title: string };
    branches: { enabled: boolean; eyebrow: string; title: string };
    contact: { enabled: boolean; eyebrow: string; title: string };
  };
  footer: {
    poweredByText: string;
  };
}

export interface IWebsiteConfig extends Document {
  organizationId: Types.ObjectId;
  draft: WebsiteConfigValue;
  published: WebsiteConfigValue;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const sectionSchema = {
  enabled: { type: Boolean, default: true },
  eyebrow: { type: String, default: '' },
  title: { type: String, default: '' },
};

const valueSchema = new Schema({
  template: { type: String, enum: ['CLASSIC', 'MODERN_LUXURY', 'MINIMAL_MODERN'], default: DEFAULT_WEBSITE_TEMPLATE },
  templateSettings: {
    classic: {
      heroAlignment: { type: String, enum: ['left', 'center'], default: 'left' },
      navigationStyle: { type: String, enum: ['standard', 'minimal'], default: 'standard' },
      sectionSpacing: { type: String, enum: ['comfortable', 'compact'], default: 'comfortable' },
      heroImagePosition: { type: String, enum: ['center', 'top', 'bottom'], default: 'center' },
      ctaStyle: { type: String, enum: ['solid', 'outline'], default: 'solid' },
    },
    modernLuxury: {
      heroComposition: { type: String, enum: ['full-bleed', 'split'], default: 'full-bleed' },
      navigationStyle: { type: String, enum: ['editorial', 'minimal'], default: 'editorial' },
      sectionSpacing: { type: String, enum: ['airy', 'compact'], default: 'airy' },
      imageTreatment: { type: String, enum: ['natural', 'cinematic'], default: 'natural' },
      overlayIntensity: { type: String, enum: ['soft', 'strong'], default: 'strong' },
      showHeroBadge: { type: Boolean, default: true },
    },
    minimalModern: {
      heroAlignment: { type: String, enum: ['left', 'center'], default: 'left' },
      navigationStyle: { type: String, enum: ['minimal', 'standard'], default: 'minimal' },
      sectionSpacing: { type: String, enum: ['airy', 'compact'], default: 'airy' },
      heroImagePosition: { type: String, enum: ['left', 'right'], default: 'right' },
      ctaStyle: { type: String, enum: ['solid', 'outline'], default: 'solid' },
    },
  },
  sectionOrder: { type: [String], default: DEFAULT_WEBSITE_SECTION_ORDER },
  branding: {
    primaryColor: { type: String, default: '#111111' },
    accentColor: { type: String, default: '#c59d5f' },
    backgroundColor: { type: String, default: '#f7f4ef' },
    textColor: { type: String, default: '#171717' },
    logoUrl: { type: String, default: '' },
    brandDisplay: { type: String, enum: ['text', 'logo', 'both', 'none'], default: 'text' },
    logoShape: { type: String, enum: ['circle', 'square', 'heart', 'star'], default: 'square' },
    logoSize: { type: String, enum: ['small', 'medium', 'large', 'xlarge'], default: 'medium' },
    brandLayout: { type: String, enum: ['horizontal', 'vertical'], default: 'horizontal' },
  },
  hero: {
    eyebrow: { type: String, default: 'WELCOME' },
    title: { type: String, default: 'Quality service, made easy to book.' },
    description: { type: String, default: 'Explore our services, choose a branch, and reserve your preferred schedule online.' },
    cardLabel: { type: String, default: 'ONLINE RESERVATIONS' },
    cardTitle: { type: String, default: 'Choose your service.\nPick your schedule.' },
    backgroundImageUrl: { type: String, default: '' },
  },
  bookingCta: {
    enabled: { type: Boolean, default: true },
    label: { type: String, default: 'Book an appointment' },
    mode: { type: String, enum: ['modal', 'page'], default: 'modal' },
  },
  sections: {
    services: { type: sectionSchema, default: () => ({}) },
    branches: { type: sectionSchema, default: () => ({}) },
    contact: { type: sectionSchema, default: () => ({}) },
  },
  footer: {
    poweredByText: { type: String, default: 'Powered by DoyBiz' },
  },
}, { _id: false });

const WebsiteConfigSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, unique: true, index: true },
  draft: { type: valueSchema, required: true },
  published: { type: valueSchema, required: true },
  publishedAt: { type: Date },
}, { timestamps: true });

export default mongoose.model<IWebsiteConfig>('WebsiteConfig', WebsiteConfigSchema);
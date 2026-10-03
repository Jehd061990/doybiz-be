import mongoose, { Document, Schema, Types } from 'mongoose';

export type WebsiteSectionKey = 'HERO' | 'SERVICES' | 'BRANCHES' | 'CONTACT';
export const DEFAULT_WEBSITE_SECTION_ORDER: WebsiteSectionKey[] = ['HERO', 'SERVICES', 'BRANCHES', 'CONTACT'];
export type BookingCtaMode = 'modal' | 'page';

export interface WebsiteConfigValue {
  branding: {
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
    textColor: string;
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
  sectionOrder: { type: [String], default: DEFAULT_WEBSITE_SECTION_ORDER },
  branding: {
    primaryColor: { type: String, default: '#111111' },
    accentColor: { type: String, default: '#c59d5f' },
    backgroundColor: { type: String, default: '#f7f4ef' },
    textColor: { type: String, default: '#171717' },
  },
  hero: {
    eyebrow: { type: String, default: 'WELCOME' },
    title: { type: String, default: 'Quality service, made easy to book.' },
    description: { type: String, default: 'Explore our services, choose a branch, and reserve your preferred schedule online.' },
    cardLabel: { type: String, default: 'ONLINE RESERVATIONS' },
    cardTitle: { type: String, default: 'Choose your service.\\nPick your schedule.' },
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

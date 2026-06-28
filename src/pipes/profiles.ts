import { CleansingProfile } from '../enums/cleansing-profile.enum';
import { PRICE_PROFILE } from './profiles/price.profile';
import { PHONE_PROFILE } from './profiles/phone.profile';
import { EMAIL_PROFILE } from './profiles/email.profile';
import { DATE_PROFILE } from './profiles/date.profile';
import { CURRENCY_PROFILE } from './profiles/currency.profile';
import type { CleanerStepRules } from './pipe-engine';

export const CLEANSING_PROFILES: Record<CleansingProfile, CleanerStepRules> = {
  [CleansingProfile.PRICE]: PRICE_PROFILE.pipes || {},
  [CleansingProfile.PHONE]: PHONE_PROFILE.pipes || {},
  [CleansingProfile.EMAIL]: EMAIL_PROFILE.pipes || {},
  [CleansingProfile.DATE]: DATE_PROFILE.pipes || {},
  [CleansingProfile.CURRENCY]: CURRENCY_PROFILE.pipes || {},
};

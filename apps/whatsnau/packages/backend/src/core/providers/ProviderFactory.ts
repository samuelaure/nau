import { IWhatsAppProvider } from './IWhatsAppProvider.js';
import { MetaWhatsAppProvider } from './MetaWhatsAppProvider.js';
import { YCloudWhatsAppProvider } from './YCloudWhatsAppProvider.js';
import { config } from '../config.js';

export class ProviderFactory {
  static getProvider(tenantId: string, campaignId?: string): IWhatsAppProvider {
    const providerName = config.WHATSAPP_PROVIDER;

    if (providerName === 'ycloud') {
      return new YCloudWhatsAppProvider(tenantId);
    }

    return new MetaWhatsAppProvider(tenantId, campaignId);
  }
}

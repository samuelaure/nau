import { IWhatsAppProvider } from './IWhatsAppProvider.js';
import { MetaWhatsAppProvider } from './MetaWhatsAppProvider.js';
import { YCloudWhatsAppProvider } from './YCloudWhatsAppProvider.js';
import { config } from '../config.js';

export class ProviderFactory {
  static getProvider(campaignId?: string): IWhatsAppProvider {
    const providerName = config.WHATSAPP_PROVIDER;

    if (providerName === 'ycloud') {
      return new YCloudWhatsAppProvider();
    }

    return new MetaWhatsAppProvider(campaignId);
  }
}

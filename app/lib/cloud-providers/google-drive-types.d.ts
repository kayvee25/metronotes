// Ambient type declarations for Google Identity Services and Picker API

declare namespace google {
  namespace accounts {
    namespace oauth2 {
      interface TokenClient {
        requestAccessToken: (overrides?: { prompt?: string }) => void;
      }

      interface TokenClientConfig {
        client_id: string;
        scope: string;
        callback: (response: TokenResponse) => void;
        error_callback?: (error: { type: string; message: string }) => void;
      }

      interface TokenResponse {
        access_token: string;
        expires_in: number;
        error?: string;
        error_description?: string;
      }

      function initTokenClient(config: TokenClientConfig): TokenClient;
      function revoke(token: string, callback?: () => void): void;
    }
  }

  namespace picker {
    enum Action {
      PICKED = 'picked',
      CANCEL = 'cancel',
    }

    enum ViewId {
      DOCS = 'all',
    }

    interface PickerDocument {
      id: string;
      name: string;
      mimeType: string;
      sizeBytes: number;
      url: string;
      iconUrl: string;
      thumbnails?: Array<{ url: string; width: number; height: number }>;
    }

    interface PickerCallbackData {
      action: Action;
      docs: PickerDocument[];
    }

    class DocsView {
      constructor(viewId?: ViewId);
      setIncludeFolders(include: boolean): DocsView;
      setSelectFolderEnabled(enabled: boolean): DocsView;
      setMimeTypes(mimeTypes: string): DocsView;
    }

    class PickerBuilder {
      addView(view: DocsView): PickerBuilder;
      setOAuthToken(token: string): PickerBuilder;
      setDeveloperKey(key: string): PickerBuilder;
      setCallback(callback: (data: PickerCallbackData) => void): PickerBuilder;
      setAppId(appId: string): PickerBuilder;
      setOrigin(origin: string): PickerBuilder;
      build(): Picker;
    }

    interface Picker {
      setVisible(visible: boolean): void;
      dispose(): void;
    }
  }
}

declare namespace gapi {
  function load(api: string, callback: () => void): void;
}

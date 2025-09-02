import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, Smartphone, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check if running as PWA
    const isRunningStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = (window.navigator as any).standalone === true;
    
    if (isRunningStandalone || isIOSStandalone) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const installEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(installEvent);
      setShowInstallBanner(true);
    };

    // Listen for successful app installation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallBanner(false);
      setDeferredPrompt(null);
      toast({
        title: "App Installed!",
        description: "AI ProjectHub has been installed on your device",
      });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Show iOS install banner after a delay
    if (iOS && !isRunningStandalone && !isIOSStandalone) {
      const timer = setTimeout(() => {
        setShowInstallBanner(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [toast]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      
      setDeferredPrompt(null);
      setShowInstallBanner(false);
    } catch (error) {
      console.error('Error during PWA installation:', error);
      toast({
        title: "Installation Error",
        description: "Failed to install the app. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    // Hide for this session
    sessionStorage.setItem('pwa-install-dismissed', 'true');
  };

  // Don't show if already installed or dismissed this session
  if (isInstalled || sessionStorage.getItem('pwa-install-dismissed')) {
    return null;
  }

  if (!showInstallBanner) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 bg-card border rounded-lg p-4 shadow-lg max-w-sm mx-auto">
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 p-2 rounded-lg flex-shrink-0">
          <Smartphone className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">Install AI ProjectHub</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {isIOS 
              ? "Tap the share button and select 'Add to Home Screen' for the best experience"
              : "Get the full app experience with offline access and notifications"
            }
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 hover:bg-muted rounded"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
      
      {!isIOS && deferredPrompt && (
        <div className="mt-3 flex gap-2">
          <Button
            onClick={handleInstallClick}
            size="sm"
            className="flex-1"
            data-testid="button-install-pwa"
          >
            <Download className="h-4 w-4 mr-2" />
            Install App
          </Button>
          <Button
            onClick={handleDismiss}
            variant="outline"
            size="sm"
            data-testid="button-dismiss-install"
          >
            Not Now
          </Button>
        </div>
      )}
      
      {isIOS && (
        <div className="mt-3 text-xs text-muted-foreground">
          Instructions: Safari menu → Share → Add to Home Screen
        </div>
      )}
    </div>
  );
}
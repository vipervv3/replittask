import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar,
  Link,
  Upload,
  Smartphone,
  CheckCircle,
  AlertCircle,
  Info,
  ExternalLink,
  Copy
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface CalendarSyncOptionsProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected: () => void;
}

export default function CalendarSyncOptions({ isOpen, onClose, onConnected }: CalendarSyncOptionsProps) {
  const [selectedMethod, setSelectedMethod] = useState<string>("");
  const [calendarUrl, setCalendarUrl] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const syncMethods = [
    {
      id: "oauth",
      title: "Sign in with Microsoft",
      description: "Securely connect your Outlook account with one click",
      icon: <Calendar className="w-5 h-5" />,
      difficulty: "Easy",
      difficultyColor: "bg-green-100 text-green-800",
      pros: ["Automatic sync", "Most secure", "No manual setup"],
      cons: ["Requires Microsoft account"],
      coming: true,
    },
    {
      id: "mobile",
      title: "Mobile Calendar App",
      description: "Use your phone's built-in calendar app to share events",
      icon: <Smartphone className="w-5 h-5" />,
      difficulty: "Easy",
      difficultyColor: "bg-green-100 text-green-800",
      pros: ["Works on any phone", "Built-in sharing", "No URLs needed"],
      coming: true,
    },
    {
      id: "file",
      title: "Upload ICS File",
      description: "Export your calendar as an ICS file and upload it",
      icon: <Upload className="w-5 h-5" />,
      difficulty: "Easy",
      difficultyColor: "bg-green-100 text-green-800",
      pros: ["Works with any calendar", "No account required", "Privacy-friendly", "One-time setup"],
      cons: ["No real-time updates", "Need to re-upload for changes"],
      coming: false,
    },
    {
      id: "url",
      title: "Calendar Sharing URL (Working on Timezone Fix)",
      description: "Share your calendar via ICS link - real-time sync",
      icon: <Link className="w-5 h-5" />,
      difficulty: "Medium",
      difficultyColor: "bg-blue-100 text-blue-800",
      pros: ["Real-time sync", "Works with any calendar", "Automatic updates", "Timezone fix in progress"],
      cons: ["Timezone issues (being fixed)", "Some setup needed"],
      coming: false,
    }
  ];

  const setupOAuthMutation = useMutation({
    mutationFn: async () => {
      setIsConnecting(true);
      // This would connect to Microsoft Graph API
      const response = await fetch("/api/outlook/oauth/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      
      if (!response.ok) {
        throw new Error("OAuth connection not available yet");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      if (data.authUrl) {
        window.open(data.authUrl, '_blank', 'width=600,height=700');
        // In a real implementation, this would handle the OAuth callback
      }
      onConnected();
      onClose();
      setIsConnecting(false);
    },
    onError: (error) => {
      toast({
        title: "Coming Soon",
        description: "Microsoft Sign-in will be available in the next update. For now, use the sharing URL method.",
        variant: "default",
      });
      setIsConnecting(false);
    },
  });

  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      setIsUploading(true);
      const fileContent = await file.text();
      
      const response = await fetch("/api/calendar/upload-ics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileContent,
          fileName: file.name
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to upload calendar file');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setIsUploading(false);
      toast({
        title: "Calendar Imported!",
        description: `Successfully imported ${data.stats.eventCount} events from ${data.stats.fileName}`,
      });
      onConnected();
      onClose();
    },
    onError: (error) => {
      setIsUploading(false);
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Could not import calendar file",
        variant: "destructive",
      });
    },
  });

  const setupUrlMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/outlook/configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calendarUrl: calendarUrl.trim(),
          enabled: true
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to configure calendar');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/outlook/events"] });
      toast({
        title: "Calendar Connected",
        description: "Your calendar is now synced successfully",
      });
      onConnected();
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Could not connect calendar",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Instructions copied to clipboard",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Choose Your Calendar Sync Method</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Method Selection */}
          <div className="grid gap-4 md:grid-cols-2">
            {syncMethods.map((method) => (
              <Card 
                key={method.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedMethod === method.id ? "ring-2 ring-blue-500" : ""
                } ${method.coming ? "opacity-75" : ""}`}
                onClick={() => !method.coming && setSelectedMethod(method.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        {method.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <CardTitle className="text-sm">{method.title}</CardTitle>
                          {method.coming && (
                            <Badge variant="outline" className="text-xs">
                              Coming Soon
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Badge className={method.difficultyColor} variant="secondary">
                      {method.difficulty}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-gray-600">{method.description}</p>
                  
                  <div className="space-y-2">
                    <div className="flex items-center space-x-1">
                      <CheckCircle className="w-3 h-3 text-green-600" />
                      <span className="text-xs text-gray-600">Pros:</span>
                    </div>
                    <ul className="text-xs text-gray-600 space-y-1 ml-4">
                      {method.pros.map((pro, i) => (
                        <li key={i}>• {pro}</li>
                      ))}
                    </ul>
                    
                    {method.cons && (
                      <>
                        <div className="flex items-center space-x-1">
                          <AlertCircle className="w-3 h-3 text-amber-600" />
                          <span className="text-xs text-gray-600">Cons:</span>
                        </div>
                        <ul className="text-xs text-gray-600 space-y-1 ml-4">
                          {method.cons.map((con, i) => (
                            <li key={i}>• {con}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Setup for Selected Method */}
          {selectedMethod === "file" && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                    <h3 className="font-semibold text-amber-900">Upload ICS File (One-Time Import)</h3>
                  </div>
                  
                  <div className="bg-white p-4 rounded-lg border border-amber-200">
                    <div className="flex items-start space-x-3">
                      <Info className="w-5 h-5 text-amber-600 mt-0.5" />
                      <div className="space-y-2">
                        <p className="text-sm text-amber-800 font-medium">Important: This method has the same timezone issues as the URL method</p>
                        <p className="text-sm text-gray-700">
                          File upload imports your calendar once but doesn't provide real-time sync. You'll need to re-upload the file whenever your calendar changes.
                        </p>
                        <p className="text-sm text-gray-600">
                          For real-time updates, the sharing URL method works better despite being more complex.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white p-4 rounded-lg border space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900">How to Export Your Calendar:</h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(`Export from Outlook:
1. Open Outlook.com
2. Go to Calendar
3. Click Settings gear > View all Outlook settings
4. Go to Calendar > Shared calendars
5. Click "Publish a calendar" 
6. Select your calendar and click "Publish"
7. Download the ICS file

Export from Google Calendar:
1. Go to calendar.google.com
2. Click Settings gear > Settings
3. Select your calendar from the left
4. Scroll to "Integrate calendar"
5. Click on "Secret address in iCal format"
6. Save the file from that link

Export from Apple Calendar:
1. Open Calendar app
2. Select the calendar
3. File > Export > Export...
4. Save as .ics file`)}
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy Guide
                      </Button>
                    </div>
                    
                    <div className="grid md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <h5 className="font-medium text-sm">Outlook.com</h5>
                        <ol className="text-xs text-gray-600 space-y-1">
                          <li>1. Settings → View all settings</li>
                          <li>2. Calendar → Shared calendars</li>
                          <li>3. Publish calendar → Download</li>
                        </ol>
                      </div>
                      
                      <div className="space-y-1">
                        <h5 className="font-medium text-sm">Google Calendar</h5>
                        <ol className="text-xs text-gray-600 space-y-1">
                          <li>1. Settings → Your calendar</li>
                          <li>2. Integrate calendar section</li>
                          <li>3. Download iCal format</li>
                        </ol>
                      </div>
                      
                      <div className="space-y-1">
                        <h5 className="font-medium text-sm">Apple Calendar</h5>
                        <ol className="text-xs text-gray-600 space-y-1">
                          <li>1. Select calendar</li>
                          <li>2. File → Export</li>
                          <li>3. Save as .ics file</li>
                        </ol>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="ics-file" className="text-sm font-medium">
                      Select your calendar file (.ics)
                    </Label>
                    <Input
                      id="ics-file"
                      type="file"
                      accept=".ics"
                      className="cursor-pointer"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setSelectedFile(file);
                          toast({
                            title: "File Selected",
                            description: `${file.name} ready to upload`,
                          });
                        }
                      }}
                    />
                    <p className="text-xs text-gray-500">
                      Choose a .ics file exported from your calendar app
                    </p>
                  </div>

                  <Button 
                    className="w-full"
                    disabled={!selectedFile || isUploading}
                    onClick={() => {
                      if (selectedFile) {
                        uploadFileMutation.mutate(selectedFile);
                      }
                    }}
                  >
                    {isUploading ? "Importing Calendar..." : 
                     selectedFile ? `Import ${selectedFile.name}` : "Select a file first"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {selectedMethod === "oauth" && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Info className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-blue-900">Microsoft Sign-in (Requires Account)</h3>
                  </div>
                  
                  <div className="bg-white p-4 rounded-lg border">
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                      <div className="space-y-2">
                        <p className="text-sm text-gray-700">
                          This method requires a Microsoft account. Since you don't have one, try the <strong>Upload ICS File</strong> option instead - it works great without any account!
                        </p>
                        <p className="text-sm text-gray-600">
                          If you create a Microsoft account later, this feature will allow automatic sync.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <Button 
                    variant="outline"
                    className="w-full"
                    onClick={() => setSelectedMethod("file")}
                  >
                    Try File Upload Instead
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {selectedMethod === "url" && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-blue-900">Calendar Sharing URL (Timezone Fix Applied!)</h3>
                  </div>
                  
                  <div className="bg-white p-4 rounded-lg border border-blue-200">
                    <div className="flex items-start space-x-3">
                      <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div className="space-y-2">
                        <p className="text-sm text-blue-800 font-medium">Good news! I just fixed the timezone parsing</p>
                        <p className="text-sm text-gray-700">
                          Your calendar events should now show the correct times. The system now properly handles Eastern, Central, and other timezones from your calendar.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="url-input">Calendar Sharing URL</Label>
                      <Input
                        id="url-input"
                        value={calendarUrl}
                        onChange={(e) => setCalendarUrl(e.target.value)}
                        placeholder="https://outlook.office365.com/.../calendar.ics"
                        className="mt-1"
                      />
                    </div>

                    <div className="bg-white p-4 rounded-lg border space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900">Quick Setup Guide</h4>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(`1. Go to Outlook.com Calendar
2. Right-click your calendar name
3. Select "Sharing and permissions"
4. Choose sharing level (Can view when I'm busy)
5. Copy the ICS link (not HTML)
6. Make sure URL ends with .ics`)}
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          Copy Guide
                        </Button>
                      </div>
                      
                      <ol className="text-sm space-y-1 text-gray-600">
                        <li>1. Go to <a href="https://outlook.com" target="_blank" className="text-blue-600 hover:underline inline-flex items-center">Outlook.com <ExternalLink className="w-3 h-3 ml-1" /></a></li>
                        <li>2. Right-click your calendar name</li>
                        <li>3. Select "Sharing and permissions"</li>
                        <li>4. Choose sharing level (Can view when I'm busy)</li>
                        <li>5. Copy the <strong>ICS link</strong> (not HTML)</li>
                        <li>6. Make sure URL ends with <code className="bg-gray-100 px-1 rounded">.ics</code></li>
                      </ol>
                    </div>

                    <Button 
                      onClick={() => setupUrlMutation.mutate()}
                      disabled={!calendarUrl.trim() || setupUrlMutation.isPending}
                      className="w-full"
                    >
                      {setupUrlMutation.isPending ? "Connecting..." : "Connect Calendar"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {selectedMethod === "mobile" && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Smartphone className="w-5 h-5 text-green-600" />
                    <h3 className="font-semibold text-green-900">Mobile Calendar App (Coming Soon)</h3>
                  </div>
                  
                  <div className="bg-white p-4 rounded-lg border">
                    <div className="flex items-start space-x-3">
                      <Info className="w-5 h-5 text-green-600 mt-0.5" />
                      <div className="space-y-2">
                        <p className="text-sm text-gray-700">
                          This will be the easiest way to sync your calendar:
                        </p>
                        <ul className="text-sm text-gray-600 space-y-1 ml-2">
                          <li>• Open your phone's calendar app</li>
                          <li>• Use built-in "Share Calendar" feature</li>
                          <li>• Generate QR code or simple link</li>
                          <li>• Scan or click to connect instantly</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
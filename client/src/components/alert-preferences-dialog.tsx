import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Settings2, Bell, BellOff, AlertTriangle, CheckCircle2, Wrench, Loader2 } from "lucide-react";

interface AlertPreferencesDialogProps {
  vendorKey: string;
  vendorName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface VendorComponent {
  id: string;
  componentId: string;
  name: string;
  groupName: string | null;
  status: string;
}

interface Preferences {
  componentFilters: string[] | null;
  alertOnNew: boolean;
  alertOnUpdate: boolean;
  alertOnResolved: boolean;
  alertOnMaintenance: boolean;
  maintenanceReminder: boolean;
  maintenanceReminderMinutes: number;
}

export function AlertPreferencesDialog({ vendorKey, vendorName, open, onOpenChange }: AlertPreferencesDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [prefs, setPrefs] = useState<Preferences>({
    componentFilters: null,
    alertOnNew: true,
    alertOnUpdate: true,
    alertOnResolved: true,
    alertOnMaintenance: true,
    maintenanceReminder: false,
    maintenanceReminderMinutes: 60,
  });
  const [componentFilterEnabled, setComponentFilterEnabled] = useState(false);
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);

  const { data: currentPrefs, isLoading: prefsLoading } = useQuery<Preferences>({
    queryKey: ["vendor-prefs", vendorKey],
    queryFn: async () => {
      const res = await fetch(`/api/vendor-subscriptions/${vendorKey}/preferences`);
      if (!res.ok) throw new Error("Failed to fetch preferences");
      return res.json();
    },
    enabled: open,
  });

  const { data: components, isLoading: componentsLoading } = useQuery<VendorComponent[]>({
    queryKey: ["vendor-components", vendorKey],
    queryFn: async () => {
      const res = await fetch(`/api/vendors/${vendorKey}/components`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
  });

  useEffect(() => {
    if (currentPrefs) {
      setPrefs(currentPrefs);
      const hasFilters = currentPrefs.componentFilters && currentPrefs.componentFilters.length > 0;
      setComponentFilterEnabled(!!hasFilters);
      setSelectedComponents(hasFilters ? currentPrefs.componentFilters! : []);
    }
  }, [currentPrefs]);

  const saveMutation = useMutation({
    mutationFn: async (updatedPrefs: Partial<Preferences>) => {
      const res = await fetch(`/api/vendor-subscriptions/${vendorKey}/preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedPrefs),
      });
      if (!res.ok) throw new Error("Failed to save preferences");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-prefs", vendorKey] });
      toast({
        title: "Preferences Saved",
        description: `Alert preferences for ${vendorName} updated.`,
        className: "bg-emerald-500 border-emerald-500 text-white",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const payload: Partial<Preferences> = {
      alertOnNew: prefs.alertOnNew,
      alertOnUpdate: prefs.alertOnUpdate,
      alertOnResolved: prefs.alertOnResolved,
      alertOnMaintenance: prefs.alertOnMaintenance,
      maintenanceReminder: prefs.maintenanceReminder,
      maintenanceReminderMinutes: prefs.maintenanceReminderMinutes,
      componentFilters: componentFilterEnabled ? selectedComponents : null,
    };
    saveMutation.mutate(payload);
  };

  const toggleComponent = (componentName: string) => {
    setSelectedComponents(prev =>
      prev.includes(componentName)
        ? prev.filter(c => c !== componentName)
        : [...prev, componentName]
    );
  };

  const groupedComponents = (components || []).reduce((acc, comp) => {
    const group = comp.groupName || "Services";
    if (!acc[group]) acc[group] = [];
    acc[group].push(comp);
    return acc;
  }, {} as Record<string, VendorComponent[]>);

  const isLoading = prefsLoading || componentsLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Alert Preferences
          </DialogTitle>
          <DialogDescription>
            Configure which alerts you receive for <strong>{vendorName}</strong>.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-2">
            <div className="space-y-4">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Incident Lifecycle
              </h4>
              <p className="text-xs text-muted-foreground">Choose which stages of an incident trigger a notification.</p>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">New Incidents</Label>
                    <p className="text-xs text-muted-foreground">When a new incident is reported</p>
                  </div>
                  <Switch
                    checked={prefs.alertOnNew}
                    onCheckedChange={(v) => setPrefs(p => ({ ...p, alertOnNew: v }))}
                    data-testid="switch-alert-new"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Incident Updates</Label>
                    <p className="text-xs text-muted-foreground">When an existing incident is updated</p>
                  </div>
                  <Switch
                    checked={prefs.alertOnUpdate}
                    onCheckedChange={(v) => setPrefs(p => ({ ...p, alertOnUpdate: v }))}
                    data-testid="switch-alert-update"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Incident Resolved</Label>
                    <p className="text-xs text-muted-foreground">When an incident is resolved</p>
                  </div>
                  <Switch
                    checked={prefs.alertOnResolved}
                    onCheckedChange={(v) => setPrefs(p => ({ ...p, alertOnResolved: v }))}
                    data-testid="switch-alert-resolved"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-sidebar-border pt-4 space-y-4">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Wrench className="w-4 h-4" />
                Maintenance
              </h4>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Maintenance Alerts</Label>
                    <p className="text-xs text-muted-foreground">Get notified about scheduled maintenance</p>
                  </div>
                  <Switch
                    checked={prefs.alertOnMaintenance}
                    onCheckedChange={(v) => setPrefs(p => ({ ...p, alertOnMaintenance: v }))}
                    data-testid="switch-alert-maintenance"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Maintenance Reminders</Label>
                    <p className="text-xs text-muted-foreground">Get a reminder before maintenance starts</p>
                  </div>
                  <Switch
                    checked={prefs.maintenanceReminder}
                    onCheckedChange={(v) => setPrefs(p => ({ ...p, maintenanceReminder: v }))}
                    data-testid="switch-maintenance-reminder"
                  />
                </div>

                {prefs.maintenanceReminder && (
                  <div className="ml-4 flex items-center gap-3">
                    <Label className="text-sm text-muted-foreground">Remind me</Label>
                    <Select
                      value={String(prefs.maintenanceReminderMinutes)}
                      onValueChange={(v) => setPrefs(p => ({ ...p, maintenanceReminderMinutes: parseInt(v) }))}
                    >
                      <SelectTrigger className="w-[140px]" data-testid="select-reminder-minutes">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[200]">
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="120">2 hours</SelectItem>
                        <SelectItem value="240">4 hours</SelectItem>
                        <SelectItem value="1440">24 hours</SelectItem>
                      </SelectContent>
                    </Select>
                    <Label className="text-sm text-muted-foreground">before</Label>
                  </div>
                )}
              </div>
            </div>

            {components && components.length > 0 && (
              <div className="border-t border-sidebar-border pt-4 space-y-4">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Component Filtering
                </h4>
                <p className="text-xs text-muted-foreground">
                  Only receive alerts for specific service components. When disabled, you'll be alerted about all components.
                </p>

                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Enable component filtering</Label>
                  <Switch
                    checked={componentFilterEnabled}
                    onCheckedChange={(v) => {
                      setComponentFilterEnabled(v);
                      if (!v) setSelectedComponents([]);
                    }}
                    data-testid="switch-component-filter"
                  />
                </div>

                {componentFilterEnabled && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedComponents(components.map(c => c.name))}
                        data-testid="button-select-all-components"
                      >
                        Select All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedComponents([])}
                        data-testid="button-clear-all-components"
                      >
                        Clear All
                      </Button>
                      <Badge variant="secondary" className="ml-auto">
                        {selectedComponents.length} / {components.length} selected
                      </Badge>
                    </div>

                    <div className="max-h-[200px] overflow-y-auto border border-sidebar-border rounded-md p-2 space-y-3">
                      {Object.entries(groupedComponents).map(([group, comps]) => (
                        <div key={group}>
                          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">{group}</p>
                          <div className="space-y-1">
                            {comps.map(comp => (
                              <div key={comp.id} className="flex items-center gap-2 py-0.5">
                                <Checkbox
                                  checked={selectedComponents.includes(comp.name)}
                                  onCheckedChange={() => toggleComponent(comp.name)}
                                  id={`comp-${comp.id}`}
                                  data-testid={`checkbox-component-${comp.componentId}`}
                                />
                                <Label htmlFor={`comp-${comp.id}`} className="text-sm cursor-pointer flex items-center gap-2">
                                  <span
                                    className={`w-2 h-2 rounded-full inline-block ${
                                      comp.status === 'operational' ? 'bg-emerald-500' :
                                      comp.status === 'degraded_performance' ? 'bg-yellow-500' :
                                      comp.status === 'partial_outage' ? 'bg-orange-500' :
                                      comp.status === 'major_outage' ? 'bg-red-500' :
                                      'bg-blue-500'
                                    }`}
                                  />
                                  {comp.name}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-prefs">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            data-testid="button-save-prefs"
          >
            {saveMutation.isPending ? "Saving..." : "Save Preferences"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

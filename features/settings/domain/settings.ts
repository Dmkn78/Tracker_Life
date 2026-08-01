export type TrackingSettings = {
  calorieTarget: number;
  defaultSleepDelayMin: number;
  theme: string;
};

export type TrackingSettingsPatch = Pick<
  TrackingSettings,
  "calorieTarget" | "defaultSleepDelayMin"
>;

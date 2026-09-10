"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Droplet, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getGardenPlantingDisplay } from "@/lib/garden";
import { ExpandGardenButton } from "@/components/expand-garden-button";
import { PlantSeedModal, type InventoryOption } from "./plant-seed-modal";
import type { GardenPlantingWithPlant } from "@/lib/supabase/types";

const PLOTS_PER_ROW = 5;

function PlotCell({
  userId,
  planting,
  onEmptyClick,
}: {
  userId: string;
  planting: GardenPlantingWithPlant | undefined;
  onEmptyClick: () => void;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleWater() {
    if (!planting) return;
    setIsPending(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("water_plant", {
      p_user_id: userId,
      p_planting_id: planting.id,
    });
    setIsPending(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    router.refresh();
  }

  async function handleHarvest() {
    if (!planting) return;
    setIsPending(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("harvest_plot", {
      p_user_id: userId,
      p_planting_id: planting.id,
    });
    setIsPending(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    router.refresh();
  }

  if (!planting) {
    return (
      <button
        type="button"
        onClick={onEmptyClick}
        className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-green-400 bg-green-50/50 text-green-800 hover:bg-green-100 dark:border-stone-700 dark:bg-stone-900/40 dark:text-green-400 dark:hover:bg-stone-800"
      >
        <span className="text-2xl leading-none">+</span>
        <span className="text-[10px] font-medium uppercase tracking-wide">Plant</span>
      </button>
    );
  }

  const display = getGardenPlantingDisplay(planting);
  const imageUrl =
    display.stage === 3
      ? planting.plant?.image_stage3_url
      : display.stage === 2
        ? planting.plant?.image_stage2_url
        : planting.plant?.image_stage1_url;

  return (
    <div
      className={`relative flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 p-1 text-center ${
        display.isWilted
          ? "border-amber-950 bg-amber-950/10 dark:bg-amber-950/30"
          : display.isReady
            ? "border-yellow-500 bg-yellow-100 dark:bg-yellow-900/30"
            : "border-green-500 bg-green-50 dark:bg-stone-900"
      }`}
    >
      {display.needsWater ? (
        <Droplet
          size={16}
          className="absolute -right-1.5 -top-1.5 rounded-full bg-sky-500 p-0.5 text-white shadow"
          fill="currentColor"
        />
      ) : null}
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={planting.plant?.name ?? ""}
          width={48}
          height={48}
          className={`h-10 w-10 object-contain ${display.isWilted ? "grayscale" : ""}`}
        />
      ) : null}
      <span className="truncate text-[10px] font-medium">
        {display.isWilted ? "Wilted" : planting.plant?.name}
      </span>

      {display.isReady || display.isWilted ? (
        <button
          type="button"
          onClick={handleHarvest}
          disabled={isPending}
          className="absolute inset-x-1 bottom-1 rounded bg-amber-800 px-1 py-0.5 text-[10px] font-medium text-white hover:bg-amber-700 disabled:opacity-60 dark:bg-amber-200 dark:text-amber-950"
        >
          {isPending ? "…" : "Harvest"}
        </button>
      ) : display.needsWater ? (
        <button
          type="button"
          onClick={handleWater}
          disabled={isPending}
          className="absolute inset-x-1 bottom-1 rounded bg-sky-600 px-1 py-0.5 text-[10px] font-medium text-white hover:bg-sky-500 disabled:opacity-60"
        >
          {isPending ? "…" : "Water"}
        </button>
      ) : null}

      {error ? (
        <p className="absolute -bottom-5 left-0 right-0 truncate text-[9px] text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </div>
  );
}

export function GardenGrid({
  userId,
  gardenRows,
  plantings,
  seedOptions,
  fertilizerOptions,
  coinBalance,
  expansionCost,
}: {
  userId: string;
  gardenRows: number;
  plantings: GardenPlantingWithPlant[];
  seedOptions: InventoryOption[];
  fertilizerOptions: InventoryOption[];
  coinBalance: number;
  expansionCost: number;
}) {
  const [activePlotIndex, setActivePlotIndex] = useState<number | null>(null);
  const plantingByPlot = new Map(plantings.map((p) => [p.plot_index, p]));

  const rowsToShow = gardenRows + 1; // one extra, always-locked preview row

  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: rowsToShow }, (_, rowIndex) => {
        const isLocked = rowIndex >= gardenRows;

        if (isLocked) {
          return (
            <div
              key={rowIndex}
              className="flex items-center justify-center gap-3 rounded-lg border-2 border-dashed border-stone-300 bg-stone-100/60 p-4 dark:border-stone-700 dark:bg-stone-900/40"
            >
              <Lock size={16} className="text-stone-400" />
              <ExpandGardenButton userId={userId} cost={expansionCost} canAfford={coinBalance >= expansionCost} />
            </div>
          );
        }

        return (
          <div key={rowIndex} className="grid grid-cols-5 gap-3">
            {Array.from({ length: PLOTS_PER_ROW }, (_, col) => {
              const plotIndex = rowIndex * PLOTS_PER_ROW + col;
              return (
                <PlotCell
                  key={plotIndex}
                  userId={userId}
                  planting={plantingByPlot.get(plotIndex)}
                  onEmptyClick={() => setActivePlotIndex(plotIndex)}
                />
              );
            })}
          </div>
        );
      })}

      {activePlotIndex !== null ? (
        <PlantSeedModal
          userId={userId}
          plotIndex={activePlotIndex}
          seedOptions={seedOptions}
          fertilizerOptions={fertilizerOptions}
          onClose={() => setActivePlotIndex(null)}
        />
      ) : null}
    </div>
  );
}

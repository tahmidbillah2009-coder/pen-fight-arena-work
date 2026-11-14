import React from 'react';
import { MultiplayerPlayerState } from '../game/MultiplayerTypes';

interface TurnTransitionBannerProps {
  player: MultiplayerPlayerState | null;
  onDismiss?: () => void;
}

/** Turn transitions are handled inline in the perimeter HUD and on the 3D pen without popping up over the desk. */
export const TurnTransitionBanner: React.FC<TurnTransitionBannerProps> = () => null;

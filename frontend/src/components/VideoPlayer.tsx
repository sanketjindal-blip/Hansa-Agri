/**
 * Thin wrapper around `expo-video` that mirrors the old `<Video>` component's
 * API surface for the very common case: show a remote video clip with native
 * controls. Replaces the deprecated `expo-av` usage across HANSA.
 */
import React from 'react';
import { VideoView, useVideoPlayer } from 'expo-video';

type Props = {
  uri: string;
  style?: any;
  loop?: boolean;
  contentFit?: 'cover' | 'contain' | 'fill';
};

export default function VideoPlayer({ uri, style, loop = false, contentFit = 'contain' }: Props) {
  const player = useVideoPlayer(uri, p => {
    p.loop = loop;
  });
  return (
    <VideoView
      player={player}
      style={style}
      contentFit={contentFit}
      nativeControls
      allowsFullscreen
      allowsPictureInPicture
    />
  );
}

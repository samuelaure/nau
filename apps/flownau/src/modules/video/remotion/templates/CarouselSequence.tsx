import React from 'react'
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion'

export interface CarouselSlide {
  title?: string
  content?: string
  isCover?: boolean
}

export interface CarouselTheme {
  primary: string
  background: string
  text: string
  fontFamily: string
}

export interface CarouselProps {
  slides: CarouselSlide[]
  theme?: CarouselTheme
  fps?: number
  durationPerSlideInFrames?: number
}

const DEFAULT_THEME: CarouselTheme = {
  primary: '#10b981', // naŭ green
  background: '#ffffff',
  text: '#111827',
  fontFamily: 'Inter',
}

const SlideComponent: React.FC<{ slide: CarouselSlide; theme: CarouselTheme }> = ({
  slide,
  theme,
}) => {
  const hasTitle = !!slide.title?.trim()
  const hasContent = !!slide.content?.trim()

  const titleStyles: React.CSSProperties = {
    fontFamily: `"${theme.fontFamily}", sans-serif`,
    fontWeight: 800,
    fontSize: !hasContent ? '96px' : '80px',
    lineHeight: 1.1,
    textTransform: 'uppercase',
    color: theme.primary,
    margin: hasContent ? '0 0 60px 0' : '0',
    padding: 0,
    textAlign: !hasContent ? 'center' : 'left',
    whiteSpace: 'pre-line',
  }

  const contentStyles: React.CSSProperties = {
    fontFamily: `"${theme.fontFamily}", sans-serif`,
    fontWeight: 500,
    fontSize: !hasTitle ? '64px' : '44px',
    lineHeight: 1.6,
    color: theme.text,
    margin: 0,
    padding: 0,
    textAlign: !hasTitle ? 'center' : 'left',
    whiteSpace: 'pre-line',
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.background,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '140px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '880px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          flex: 1,
        }}
      >
        {hasTitle && <h1 style={titleStyles}>{slide.title}</h1>}
        {hasContent && <p style={contentStyles}>{slide.content}</p>}
      </div>

      {/* Tracker / Watermark logic from carrousel-automation could be added here */}
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <p
          style={{
            fontFamily: `"${theme.fontFamily}", sans-serif`,
            color: '#9ca3af',
            fontWeight: 600,
            fontSize: '24px',
          }}
        >
          desliza ➔
        </p>
      </div>
    </AbsoluteFill>
  )
}

export const CarouselSequence: React.FC<CarouselProps> = ({
  slides,
  theme = DEFAULT_THEME,
  durationPerSlideInFrames = 30, // Defaults to 1 second per slide at 30fps just for preview sequence in Remotion Player
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: theme.background }}>
      {slides.map((slide, index) => {
        return (
          <Sequence
            key={index}
            from={index * durationPerSlideInFrames}
            durationInFrames={durationPerSlideInFrames}
          >
            <SlideComponent slide={slide} theme={theme} />
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}

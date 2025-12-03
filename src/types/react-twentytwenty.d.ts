declare module 'react-twentytwenty' {
  import * as React from 'react'

  export type HorizontalAlign = 'left' | 'center' | 'right'
  export type VerticalAlign = 'top' | 'middle' | 'bottom'

  export type TwentyTwentyProps = {
    left: React.ReactNode
    right: React.ReactNode
    slider?: React.ReactNode
    verticalAlign?: VerticalAlign
    leftHorizontalAlign?: HorizontalAlign
    rightHorizontalAlign?: HorizontalAlign
    minDistanceToBeginInteraction?: number
    maxAngleToBeginInteraction?: number
    defaultPosition?: number
    position?: number
    isDraggingEnabled?: boolean
    onChange?: (position: number) => void
  }

  export default class TwentyTwenty extends React.Component<TwentyTwentyProps> {}
}

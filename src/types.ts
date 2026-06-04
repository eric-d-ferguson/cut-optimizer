export type StockType = 'sheet' | 'dimensional'

export interface StockPiece {
  id: string
  label: string
  type: StockType
  width: number   // inches
  length: number  // inches
  quantity: number
}

export interface DesiredCut {
  id: string
  label: string
  width: number   // inches
  length: number  // inches
  quantity: number
}

export interface CutPlacement {
  cut: DesiredCut
  x: number
  y: number
  rotated: boolean
}

export interface CutPlan {
  stock: StockPiece
  placements: CutPlacement[]
  wastePercent: number
}

export interface OptimizeResult {
  plans: CutPlan[]
  kerf: number
  unplacedCuts: DesiredCut[]
}

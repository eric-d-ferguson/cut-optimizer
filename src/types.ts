export type StockType = 'sheet' | 'dimensional'
export type Unit = 'in' | 'ft'

export interface StockPiece {
  id: string
  label: string
  type: StockType
  width: number   // stored in inches
  length: number  // stored in inches
  quantity: number
  unit: Unit      // unit the user entered / wants displayed
}

export interface DesiredCut {
  id: string
  label: string
  width: number   // stored in inches
  length: number  // stored in inches
  quantity: number
  unit: Unit      // unit the user entered / wants displayed
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

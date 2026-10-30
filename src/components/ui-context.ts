import { createContext, useContext } from 'react'
import type { Transaction } from '../lib/types'

export interface UiValue { openTx: (tx?: Transaction) => void }
export const UiContext = createContext<UiValue>({ openTx: () => {} })
export const useUi = () => useContext(UiContext)

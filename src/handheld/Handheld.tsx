import { Suspense } from 'react'
import { Back } from './Back'
import { Cartridge } from './Cartridge'
import { Critters } from './Critters'
import { ActionButtons, DPad, MenuButtons } from './Controls3D'
import { Screen } from './Screen'
import { Shell } from './Shell'
import { Stickers } from './Stickers'

/** The whole device, centred on the origin, front facing +z. */
export function Handheld() {
  return (
    <group>
      <Shell />
      <Screen />
      <DPad />
      <ActionButtons />
      <MenuButtons />
      <Suspense fallback={null}>
        <Stickers />
      </Suspense>
      <Back />
      <Cartridge />
      <Critters />
    </group>
  )
}

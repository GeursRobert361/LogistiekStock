import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DeliveryProductRow } from '../DeliveryProductRow'
import { demoProducts } from '@/lib/seed/catalogue'
import type { StopProductPlan } from '@/services/deliveryService'

/**
 * De opmerking over waar de voorraad ligt, op de afleverregel.
 *
 * Het hele punt van die tekst is dat een vuller hem ziet staan; dat is dus ook
 * wat hier getest wordt, en niet alleen dat de prop doorgegeven wordt.
 */

const beker = demoProducts.find((p) => p.id === 'bierbeker-05')!

const plan: StopProductPlan = {
  productId: 'bierbeker-05',
  plannedPackages: 3,
  deliveredPackages: 0,
  targetPackages: 5,
  isDelivered: false,
}

async function noop() {}

describe('DeliveryProductRow', () => {
  it('toont de opmerking bij het product', () => {
    render(
      <DeliveryProductRow
        product={beker}
        plan={plan}
        storageNote="2 dozen achter in de kiosk"
        onSubmit={noop}
      />
    )

    expect(screen.getByText('2 dozen achter in de kiosk')).toBeVisible()
  })

  it('laat de regel met rust wanneer er niets te melden is', () => {
    render(<DeliveryProductRow product={beker} plan={plan} onSubmit={noop} />)

    expect(screen.queryByText(/achter in de kiosk/)).toBeNull()
    expect(screen.getByText('Bierbekers 0,5')).toBeVisible()
  })

  it('laat de opmerking los zodra de regel bevestigd is', () => {
    // Dan is het geen aanwijzing meer maar ruis op een scherm vol regels.
    render(
      <DeliveryProductRow
        product={beker}
        plan={{ ...plan, isDelivered: true, deliveredPackages: 3 }}
        storageNote="2 dozen achter in de kiosk"
        onSubmit={noop}
      />
    )

    expect(screen.queryByText('2 dozen achter in de kiosk')).toBeNull()
  })
})

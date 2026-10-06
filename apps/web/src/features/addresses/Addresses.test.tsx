import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flush } from '@/lib/analytics';
import { setGeoAvailable } from '@/test/addressServer';
import { addUser } from '@/test/authServer';
import { renderRoute } from '@/test/render';
import { receivedEvents } from '@/test/server';

// Leaflet needs a real browser; in jsdom the map is a stub that "taps" a fixed point.
vi.mock('./MapView', () => ({
  default: ({ onPick }: { onPick?: (lat: number, lon: number) => void }) =>
    onPick ? (
      <button type="button" onClick={() => onPick(12.97, 77.64)}>
        Tap map
      </button>
    ) : (
      <div>Map preview</div>
    ),
}));

const KARAN = { name: 'Karan Aneja', email: 'karan@example.com', mobile: '9876543210', password: 'correct horse battery' };

beforeEach(async () => {
  flush();
  await new Promise((resolve) => setTimeout(resolve, 20));
  receivedEvents.length = 0;
});

async function fillDetails(user: ReturnType<typeof userEvent.setup>, flat = 'Flat 4B, Lake View') {
  await user.type(await screen.findByLabelText('Flat, house no., building'), flat);
}

describe('addresses', () => {
  it('sends guests to sign in first', async () => {
    const { location } = renderRoute('/account/addresses');
    await waitFor(() => expect(location().pathname).toBe('/login'));
    expect(location().search).toBe('?returnTo=%2Faccount%2Faddresses');
  });

  it('adds an address by search: suggestion → confirm → pre-filled form → save as default', async () => {
    addUser(KARAN, { signedIn: true });
    const user = userEvent.setup();
    const { location } = renderRoute('/account/addresses');
    await user.click(await screen.findByRole('link', { name: 'Add address' }));

    await user.type(screen.getByLabelText('Search for your area, street or landmark'), 'Indiranagar');
    // Typing restarts the 400 ms search debounce, so allow a little longer than the default wait.
    await user.click(await screen.findByRole('button', { name: /^Indiranagar, Bengaluru/ }, { timeout: 3000 }));
    expect(screen.getByText('Indiranagar, Bengaluru 560038')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm location' }));

    expect(screen.getByLabelText('Full name')).toHaveValue('Karan Aneja');
    expect(screen.getByLabelText('Mobile number')).toHaveValue('9876543210');
    expect(screen.getByLabelText('Area, street, locality')).toHaveValue('Indiranagar');
    expect(screen.getByLabelText('Pincode')).toHaveValue('560038');
    expect(screen.getByLabelText('City')).toHaveValue('Bengaluru');
    expect(screen.getByLabelText('State')).toHaveValue('Karnataka');
    await fillDetails(user);
    await user.click(screen.getByRole('button', { name: 'Save address' }));

    await waitFor(() => expect(location().pathname).toBe('/account/addresses'));
    const card = await screen.findByRole('article', { name: 'Home address, Flat 4B, Lake View' });
    expect(within(card).getByText('Default')).toBeInTheDocument();
    expect(within(card).getByText(/Mobile ••••••3210/)).toBeInTheDocument();

    flush();
    await waitFor(() => expect(receivedEvents.find((e) => e.name === 'address_added')?.properties).toEqual({ addressType: 'home', method: 'map', isDefault: true }));
  });

  it('fills in the address when the map is tapped', async () => {
    addUser(KARAN, { signedIn: true });
    const user = userEvent.setup();
    renderRoute('/account/addresses/new');
    await user.click(await screen.findByRole('button', { name: 'Tap map' }));
    expect(await screen.findByText('HAL 2nd Stage, Bengaluru 560038')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm location' }));
    expect(screen.getByLabelText('Area, street, locality')).toHaveValue('HAL 2nd Stage');
  });

  it('works without the map: manual entry, with inline validation', async () => {
    addUser(KARAN, { signedIn: true });
    setGeoAvailable(false);
    const user = userEvent.setup();
    const { location } = renderRoute('/account/addresses/new');
    await user.type(await screen.findByLabelText('Search for your area, street or landmark'), 'Indiranagar');
    expect(await screen.findByText(/Location search isn't available right now/, {}, { timeout: 3000 })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Enter address manually instead' }));

    await user.click(screen.getByRole('button', { name: 'Save address' }));
    expect(screen.getByText('Enter flat, house or building')).toBeInTheDocument();
    expect(screen.getByText('Enter a 6-digit pincode')).toBeInTheDocument();
    expect(screen.getByText('Choose a state')).toBeInTheDocument();
    expect(screen.getByLabelText('Flat, house no., building')).toHaveFocus();

    await user.type(screen.getByLabelText('Flat, house no., building'), '22 Park Street');
    await user.type(screen.getByLabelText('Area, street, locality'), 'Park Street');
    await user.type(screen.getByLabelText('Pincode'), '700016');
    await user.type(screen.getByLabelText('City'), 'Kolkata');
    await user.selectOptions(screen.getByLabelText('State'), 'West Bengal');
    await user.click(screen.getByRole('radio', { name: 'Work' }));
    await user.click(screen.getByRole('button', { name: 'Save address' }));
    await waitFor(() => expect(location().pathname).toBe('/account/addresses'));
    expect(await screen.findByRole('article', { name: 'Work address, 22 Park Street' })).toBeInTheDocument();
  });

  it('switches the default, and deleting the default promotes the newest with Undo restoring it', async () => {
    addUser(KARAN, { signedIn: true });
    for (const [line1, line2] of [['A Block', 'One'], ['B Block', 'Two'], ['C Block', 'Three']]) {
      await fetch(new URL('/api/addresses', window.location.origin), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: 'Karan', mobile: '9876543210', pincode: '560038', line1, line2, landmark: '', city: 'Bengaluru', state: 'Karnataka', type: 'home', latitude: null, longitude: null }),
      });
    }
    const user = userEvent.setup();
    renderRoute('/account/addresses');
    const cards = async () => (await screen.findAllByRole('article')).map((a) => a.getAttribute('aria-label'));
    expect(await cards()).toEqual(['Home address, A Block', 'Home address, C Block', 'Home address, B Block']);

    await user.click(screen.getByRole('button', { name: 'Set Home address, B Block as default' }));
    await waitFor(async () => expect((await cards())[0]).toBe('Home address, B Block'));

    await user.click(screen.getByRole('button', { name: 'Delete Home address, B Block' }));
    expect(await screen.findByText('C Block, Bengaluru is now your default address.')).toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: 'Home address, C Block' })).getByText('Default')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(async () => expect((await cards())[0]).toBe('Home address, B Block'));
    expect(within(screen.getByRole('article', { name: 'Home address, B Block' })).getByText('Default')).toBeInTheDocument();
  });

  it('shows the empty state', async () => {
    addUser(KARAN, { signedIn: true });
    renderRoute('/account/addresses');
    expect(await screen.findByRole('heading', { name: 'No saved addresses yet' })).toBeInTheDocument();
  });
});

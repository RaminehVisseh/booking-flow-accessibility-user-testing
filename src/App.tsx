import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  BurritoProvider,
  Button,
  PrimaryButton,
  vars,
} from '@janeapp/burrito-design-system'

/* ─────────────────────────────────────────────────────────────────
 *  Constants
 * ───────────────────────────────────────────────────────────────── */

const BASE_DATE = new Date(2026, 6, 13) // Monday July 13 2026
const HOUR_START = 8
const HOUR_END = 18
const SHIFT_START = 9
const SHIFT_END = 16
const ROW_HEIGHT = 56 // px per hour
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i)

const TREATMENTS = [
  { id: '30m', label: '30 Minute Massage', duration: 0.5 },
  { id: '45m', label: '45 Minute Massage', duration: 0.75 },
  { id: '60m', label: '60 Minute Massage', duration: 1.0 },
  { id: '90m', label: '90 Minute Massage', duration: 1.5 },
]

const MOCK_PATIENTS = [
  'Madison Barnaby', 'Marcus Gregory', 'Maya Chen', 'Michael Torres',
  'Zoe Gagnon', 'Aubrey French', 'Eva Mackay', 'Beatrice Clark',
  'Dylan Grewal', 'Samuel Clark', 'Owen Anderson', 'Lily Smith',
]

// Pre-booked appointments [slot → {patient, treatment}]
const BOOKED_TODAY: Record<string, { patient: string; treatment: string }> = {
  '10:00': { patient: 'Maya Chen',      treatment: '60 Minute Massage' },
  '13:00': { patient: 'Marcus Gregory', treatment: '45 Minute Massage' },
}

/* ─────────────────────────────────────────────────────────────────
 *  Date helpers
 * ───────────────────────────────────────────────────────────────── */

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function formatHour(h: number): string {
  const whole = Math.floor(h)
  const min = h % 1 === 0.5 ? '30' : '00'
  const ampm = whole >= 12 ? 'PM' : 'AM'
  const display = whole > 12 ? whole - 12 : whole === 0 ? 12 : whole
  return `${display}:${min} ${ampm}`
}

function formatDay(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function formatDayShort(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long' })
}

function slotToHour(slot: string): number {
  const [h, m] = slot.split(':').map(Number)
  return h + m / 60
}

function durationHours(label: string): number {
  return TREATMENTS.find(t => t.label === label)?.duration ?? 0.5
}

/* ─────────────────────────────────────────────────────────────────
 *  Focus trap hook
 * ───────────────────────────────────────────────────────────────── */

const FOCUSABLE_SELECTOR =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

function useFocusTrap(ref: React.RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return
    const el = ref.current
    if (!el) return

    function nodes() {
      return Array.from(el!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        n => !n.closest('[hidden]') && !n.closest('[aria-hidden="true"]')
      )
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const all = nodes()
      if (!all.length) return
      const first = all[0], last = all[all.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first || !el!.contains(document.activeElement)) {
          e.preventDefault(); last.focus()
        }
      } else {
        if (document.activeElement === last || !el!.contains(document.activeElement)) {
          e.preventDefault(); first.focus()
        }
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [active, ref])
}

/* ─────────────────────────────────────────────────────────────────
 *  Visually-hidden utility
 * ───────────────────────────────────────────────────────────────── */

const srOnly: React.CSSProperties = {
  position: 'absolute', width: 1, height: 1,
  overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap',
}

/* ─────────────────────────────────────────────────────────────────
 *  Booking Panel
 * ───────────────────────────────────────────────────────────────── */

interface BookingPanelProps {
  practitioner: string
  startHour: number
  availableUntil: number
  date: Date
  bookedRanges: { start: number; end: number }[]
  onClose: () => void
  onBook: (result: { patient: string; treatment: string; startHour: number; endHour: number }) => void
  onOverlapClose: () => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
}

function BookingPanel({
  practitioner, startHour, availableUntil, date, bookedRanges,
  onClose, onBook, onOverlapClose, triggerRef,
}: BookingPanelProps) {
  const TEAL = vars.global.color.brand['70']
  const [treatment, setTreatment] = useState('')
  const [patientQuery, setPatientQuery] = useState('')
  const [patient, setPatient] = useState('')
  const [notes, setNotes] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const [overlapError, setOverlapError] = useState(false)

  const panelRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const treatmentRef = useRef<HTMLSelectElement>(null)

  const slotMins = Math.round((availableUntil - startHour) * 60)
  const eligibleTreatments = TREATMENTS.filter(t => t.duration * 60 <= slotMins)
  const selectedTreatment = TREATMENTS.find(t => t.id === treatment)
  const endHour = selectedTreatment ? startHour + selectedTreatment.duration : null

  const patientMatches = patientQuery.length >= 2
    ? MOCK_PATIENTS.filter(n => n.toLowerCase().includes(patientQuery.toLowerCase()))
    : []

  function hasOverlap(start: number, dur: number) {
    const end = start + dur
    return bookedRanges.some(r => start < r.end && end > r.start && !(start >= r.start && start < r.end))
  }

  // Auto-focus heading on open so JAWS reads dialog label
  useLayoutEffect(() => {
    const t = setTimeout(() => headingRef.current?.focus(), 100)
    return () => clearTimeout(t)
  }, [])

  // Escape closes panel unless overlap error is showing
  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape' && !overlapError) onClose()
    }
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('keydown', onEsc)
      // Return focus to the slot button that opened the panel
      ;(triggerRef as React.MutableRefObject<HTMLButtonElement | null>).current?.focus()
    }
  }, [onClose, overlapError, triggerRef])

  useFocusTrap(panelRef, true)

  function announce(msg: string) {
    setAnnouncement('')
    setTimeout(() => setAnnouncement(msg), 50)
  }

  function handleTreatmentChange(id: string) {
    setTreatment(id)
    setOverlapError(false)
    const tr = TREATMENTS.find(t => t.id === id)
    if (!tr) return
    if (hasOverlap(startHour, tr.duration)) {
      announce(`Warning: ${tr.label} will overlap ${practitioner}'s next appointment.`)
    } else {
      announce(`${tr.label} selected. Duration: ${Math.round(tr.duration * 60)} minutes.`)
    }
  }

  function handleBook() {
    if (!selectedTreatment) {
      announce('Missing session. Go to the Session field and select a treatment before booking.')
      treatmentRef.current?.focus()
      return
    }
    if (hasOverlap(startHour, selectedTreatment.duration)) {
      setOverlapError(true)
      announce('Appointment not booked. This time overlaps an existing appointment. Press Tab to return to the calendar.')
      return
    }
    onBook({
      patient: patient || 'New Patient',
      treatment: selectedTreatment.label,
      startHour,
      endHour: startHour + selectedTreatment.duration,
    })
  }

  const dateLabel = date.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 500,
        display: 'flex', justifyContent: 'flex-end',
      }}
      onClick={e => { if (e.target === e.currentTarget && !overlapError) onClose() }}
    >
      {/* Always-rendered assertive live region — JAWS needs it in DOM before content fires */}
      <div role="status" aria-live="assertive" aria-atomic="true" style={srOnly}>
        {announcement}
      </div>

      {overlapError && (
        <div
          role="alert"
          aria-atomic="true"
          style={{
            position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
            background: '#9b2020', color: '#fff',
            borderRadius: 8, padding: '12px 20px',
            fontSize: 14, fontWeight: 500,
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            zIndex: 600, maxWidth: 400, textAlign: 'center',
          }}
        >
          This appointment overlaps an existing booking. Press Tab to return to the calendar.
        </div>
      )}

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-panel-title"
        aria-describedby="booking-panel-desc"
        onKeyDown={e => {
          if (overlapError && e.key === 'Tab') {
            e.preventDefault()
            onOverlapClose()
          }
        }}
        style={{
          width: 360, height: '100%',
          background: '#fff',
          display: 'flex', flexDirection: 'column',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.16)',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #e8e8e8', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
            <h2
              id="booking-panel-title"
              ref={headingRef}
              tabIndex={-1}
              style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#222', outline: 'none' }}
            >
              New Appointment
            </h2>
            <button
              aria-label="Close new appointment panel"
              onClick={onClose}
              style={{
                background: 'none', border: '1px solid #ccc',
                borderRadius: 6, width: 34, height: 34,
                cursor: 'pointer', fontSize: 16, color: '#555',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >✕</button>
          </div>
          <p id="booking-panel-desc" style={{ margin: 0, fontSize: 13, color: '#666' }}>
            {practitioner} · {dateLabel} · {formatHour(startHour)}
          </p>
        </div>

        {/* Form */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <fieldset style={{ border: 'none', padding: '16px', margin: 0 }}>
            <legend style={srOnly}>Appointment details</legend>

            {/* Session */}
            <div style={{ marginBottom: 18 }}>
              <label
                htmlFor="treatment-select"
                style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}
              >
                Session
              </label>
              <select
                id="treatment-select"
                ref={treatmentRef}
                value={treatment}
                onChange={e => handleTreatmentChange(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px',
                  border: '1px solid #ccc', borderRadius: 6,
                  fontSize: 14, color: treatment ? '#222' : '#999',
                  background: '#fff', fontFamily: 'inherit', cursor: 'pointer',
                }}
              >
                <option value="">Select a session…</option>
                {eligibleTreatments.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
              {eligibleTreatments.length === 0 && (
                <p role="alert" style={{ margin: '6px 0 0', fontSize: 13, color: '#c00' }}>
                  No sessions fit this time slot.
                </p>
              )}
            </div>

            {/* Client */}
            <div style={{ marginBottom: 18, position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label
                  htmlFor="patient-search"
                  style={{ fontSize: 12, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                  Client
                </label>
                <button
                  type="button"
                  onClick={() => { setPatient('New Patient'); setPatientQuery('') }}
                  style={{ fontSize: 12, padding: '3px 10px', border: '1px solid #ccc', borderRadius: 4, background: '#fff', cursor: 'pointer', color: '#555', fontFamily: 'inherit' }}
                >
                  New Client
                </button>
              </div>
              {patient ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', background: '#f0faf9', border: `1px solid ${TEAL}`, borderRadius: 6, fontSize: 14 }}>
                  <span style={{ fontWeight: 600, color: '#222' }}>{patient}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${patient}`}
                    onClick={() => { setPatient(''); setPatientQuery('') }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 16, padding: 0, lineHeight: 1 }}
                  >✕</button>
                </div>
              ) : (
                <>
                  <input
                    id="patient-search"
                    type="search"
                    autoComplete="off"
                    aria-autocomplete="list"
                    aria-controls={patientMatches.length > 0 ? 'patient-suggestions' : undefined}
                    aria-expanded={patientMatches.length > 0}
                    placeholder="Search by name…"
                    value={patientQuery}
                    onChange={e => setPatientQuery(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'ArrowDown' && patientMatches.length) {
                        e.preventDefault()
                        document.querySelector<HTMLElement>('#patient-suggestions [role="option"]')?.focus()
                      }
                      if (e.key === 'Enter' && patientMatches.length === 1) {
                        e.preventDefault()
                        setPatient(patientMatches[0]); setPatientQuery('')
                      }
                    }}
                    style={{ width: '100%', padding: '9px 12px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: 6, fontSize: 14, fontFamily: 'inherit' }}
                  />
                  {patientMatches.length > 0 && (
                    <ul
                      id="patient-suggestions"
                      role="listbox"
                      aria-label="Client suggestions"
                      style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, background: '#fff', border: '1px solid #ccc', borderRadius: 6, marginTop: 2, padding: 0, listStyle: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 200, overflowY: 'auto' }}
                    >
                      {patientMatches.map((name, idx) => (
                        <li
                          key={name}
                          role="option"
                          tabIndex={-1}
                          aria-selected={false}
                          onClick={() => { setPatient(name); setPatientQuery('') }}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPatient(name); setPatientQuery('') }
                            else if (e.key === 'ArrowDown') { e.preventDefault(); document.querySelectorAll<HTMLElement>('#patient-suggestions [role="option"]')[idx + 1]?.focus() }
                            else if (e.key === 'ArrowUp') { e.preventDefault(); idx === 0 ? document.getElementById('patient-search')?.focus() : document.querySelectorAll<HTMLElement>('#patient-suggestions [role="option"]')[idx - 1]?.focus() }
                            else if (e.key === 'Escape') setPatientQuery('')
                          }}
                          style={{ padding: '9px 14px', cursor: 'pointer', fontSize: 14, color: '#222', outline: 'none' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f0faf9')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                        >
                          {name}
                        </li>
                      ))}
                    </ul>
                  )}
                  {patientQuery.length >= 2 && patientMatches.length === 0 && (
                    <p role="status" style={{ fontSize: 13, color: '#888', fontStyle: 'italic', margin: '6px 0 0' }}>
                      No clients found for "{patientQuery}"
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Time — read-only, pre-filled from slot */}
            <div style={{ marginBottom: 18 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>
                Time
              </p>
              <p style={{ margin: 0, fontSize: 14, color: '#333' }}>
                {formatHour(startHour)}{endHour !== null ? ` to ${formatHour(endHour)}` : ''}
                {endHour === null && <span style={{ color: '#888' }}> — select a session to see end time</span>}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: '#666' }}>{dateLabel}</p>
            </div>

            {/* Staff — pre-filled */}
            <div style={{ marginBottom: 18 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>
                Staff Member
              </p>
              <p style={{ margin: 0, fontSize: 14, color: '#333' }}>{practitioner}</p>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 8 }}>
              <label
                htmlFor="appt-notes"
                style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}
              >
                Notes
              </label>
              <textarea
                id="appt-notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add a note…"
                rows={3}
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', resize: 'vertical', color: '#333' }}
              />
            </div>
          </fieldset>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid #e8e8e8', background: '#fff', flexShrink: 0 }}>
          <Button onClick={onClose}>Cancel</Button>
          <PrimaryButton onClick={handleBook}>Book Appointment</PrimaryButton>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
 *  Confirmed Appointment Panel
 * ───────────────────────────────────────────────────────────────── */

function ConfirmedPanel({
  patient, treatment, startHour, endHour, practitioner, date, onClose,
}: {
  patient: string; treatment: string; startHour: number; endHour: number
  practitioner: string; date: Date; onClose: () => void
}) {
  const TEAL = vars.global.color.brand['70']
  const closeRef = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => {
    setTimeout(() => closeRef.current?.focus(), 200)
  }, [])

  const dateLabel = date.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  return (
    <aside
      aria-label={`Appointment booked for ${patient}, ${treatment}, ${formatHour(startHour)} on ${dateLabel}`}
      style={{ width: 360, height: '100%', background: '#fff', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.16)', overflowY: 'auto', flexShrink: 0 }}
    >
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #e8e8e8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#222' }}>Appointment Booked</h2>
        <button
          ref={closeRef}
          aria-label="Close appointment details"
          onClick={onClose}
          style={{ background: 'none', border: '1px solid #ccc', borderRadius: 6, width: 34, height: 34, cursor: 'pointer', fontSize: 16, color: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >✕</button>
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: '#f0faf9', border: `1px solid ${TEAL}`, borderRadius: 8, padding: '14px 16px' }}>
          <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Patient</p>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#222' }}>{patient}</p>
        </div>
        <dl style={{ margin: 0, display: 'grid', gap: 12 }}>
          {([
            ['Session', treatment],
            ['Time', `${formatHour(startHour)} to ${formatHour(endHour)}`],
            ['Date', dateLabel],
            ['Staff Member', practitioner],
          ] as const).map(([label, value]) => (
            <div key={label}>
              <dt style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</dt>
              <dd style={{ margin: '2px 0 0', fontSize: 15, color: '#222' }}>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </aside>
  )
}

/* ─────────────────────────────────────────────────────────────────
 *  Day View
 * ───────────────────────────────────────────────────────────────── */

function DayView() {
  const TEAL = vars.global.color.brand['70']
  const practitioner = 'Susan Lo'

  const [dayOffset, setDayOffset] = useState(0)
  const [bookingHour, setBookingHour] = useState<number | null>(null)
  const [bookingAvailableUntil, setBookingAvailableUntil] = useState<number | null>(null)
  const [addedBookings, setAddedBookings] = useState<Record<string, { patient: string; treatment: string }>>({})
  const [confirmedAppt, setConfirmedAppt] = useState<{ patient: string; treatment: string; startHour: number; endHour: number } | null>(null)
  const [successAnnouncement, setSuccessAnnouncement] = useState('')
  const [focusedRange, setFocusedRange] = useState<{ startHour: number; endHour: number } | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [pickerYear, setPickerYear] = useState('')
  const [pickerMonth, setPickerMonth] = useState('')
  const [pickerDay, setPickerDay] = useState('')
  const [pickerAnnouncement, setPickerAnnouncement] = useState('')

  const dateHeaderRef = useRef<HTMLDivElement>(null)
  const activeSlotRef = useRef<HTMLButtonElement | null>(null)

  const currentDay = addDays(BASE_DATE, dayOffset)
  const isToday = dayOffset === 0

  const booked = { ...BOOKED_TODAY, ...addedBookings }

  const bookedRanges = Object.entries(booked).map(([slot, appt]) => {
    const start = slotToHour(slot)
    return { start, end: start + durationHours(appt.treatment) }
  })

  function handleSlotClick(hour: number, availableUntil: number) {
    setBookingHour(hour)
    setBookingAvailableUntil(availableUntil)
    setConfirmedAppt(null)
  }

  function handleBook(result: { patient: string; treatment: string; startHour: number; endHour: number }) {
    const slot = `${String(Math.floor(result.startHour)).padStart(2, '0')}:${result.startHour % 1 === 0.5 ? '30' : '00'}`
    setAddedBookings(prev => ({ ...prev, [slot]: { patient: result.patient, treatment: result.treatment } }))
    setConfirmedAppt(result)
    setBookingHour(null)
    setSuccessAnnouncement('')
    setTimeout(() => setSuccessAnnouncement('The appointment has been booked successfully.'), 100)
  }

  // Build grid items
  const sortedBooked = [...bookedRanges].sort((a, b) => a.start - b.start)

  type GridItem =
    | { kind: 'booked'; startHour: number; endHour: number; patient: string; treatment: string }
    | { kind: 'available'; startHour: number; endHour: number }

  const gridItems: GridItem[] = []
  for (const [slot, appt] of Object.entries(booked)) {
    const s = slotToHour(slot)
    gridItems.push({ kind: 'booked', startHour: s, endHour: s + durationHours(appt.treatment), patient: appt.patient, treatment: appt.treatment })
  }
  let cursor = HOUR_START
  for (const r of sortedBooked) {
    if (r.start > cursor) gridItems.push({ kind: 'available', startHour: cursor, endHour: r.start })
    cursor = Math.max(cursor, r.end)
  }
  if (cursor < HOUR_END) gridItems.push({ kind: 'available', startHour: cursor, endHour: HOUR_END })
  gridItems.sort((a, b) => a.startHour - b.startHour)

  const apptColors = ['#a9dadc', '#bfafd4', '#84c5a8']
  const apptColorText = ['#0d3a3c', '#3d2b5a', '#0c3a26']
  const bookedSlots = Object.keys(booked)
  const colorMap = bookedSlots.reduce((acc, slot, i) => { acc[slot] = i % apptColors.length; return acc }, {} as Record<string, number>)

  function navigateToDate() {
    if (!pickerYear || !pickerMonth || !pickerDay) return
    const picked = new Date(Number(pickerYear), Number(pickerMonth) - 1, Number(pickerDay))
    const diff = Math.round((picked.getTime() - BASE_DATE.getTime()) / 86400000)
    const label = picked.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    setPickerAnnouncement(`${label} selected.`)
    setTimeout(() => {
      setDayOffset(diff)
      setShowDatePicker(false)
      setTimeout(() => dateHeaderRef.current?.focus(), 100)
    }, 1500)
  }

  return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column', background: '#f4f4f4' }}>

      {/* Always-rendered live regions — never toggled in/out so JAWS finds them */}
      <div role="status" aria-live="polite" aria-atomic="true" style={srOnly}>{successAnnouncement}</div>
      <div role="status" aria-live="polite" aria-atomic="true" style={srOnly}>{pickerAnnouncement}</div>

      {/* Skip link */}
      <a
        href="#day-grid"
        style={{ position: 'absolute', top: -100, left: 8, zIndex: 1000, background: TEAL, color: '#fff', padding: '8px 16px', borderRadius: 4, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}
        onFocus={e => { e.currentTarget.style.top = '8px' }}
        onBlur={e => { e.currentTarget.style.top = '-100px' }}
      >
        Skip to schedule
      </a>

      {/* Header */}
      <header style={{ background: TEAL, padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>Jane</span>
        <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>Booking Flow Accessibility — User Testing</span>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{practitioner}</span>
      </header>

      {/* Date nav */}
      <nav aria-label="Date navigation" style={{ background: '#fff', borderBottom: '1px solid #e2e2e2', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button
          aria-label={`Previous day, ${formatDayShort(addDays(BASE_DATE, dayOffset - 1))}`}
          onClick={() => setDayOffset(d => d - 1)}
          style={{ width: 32, height: 32, border: '1px solid #ccc', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >‹</button>

        <button
          aria-label="Go to today"
          onClick={() => setDayOffset(0)}
          style={{ padding: '5px 12px', border: '1px solid #ccc', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}
        >Today</button>

        <button
          aria-label={`Next day, ${formatDayShort(addDays(BASE_DATE, dayOffset + 1))}`}
          onClick={() => setDayOffset(d => d + 1)}
          style={{ width: 32, height: 32, border: '1px solid #ccc', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >›</button>

        <div aria-live="polite" aria-atomic="true" style={{ flex: 1, fontSize: 18, fontWeight: 700, color: '#222', marginLeft: 8 }}>
          {formatDay(currentDay)}
        </div>

        <div style={{ position: 'relative' }}>
          <button
            aria-label="Go to a specific date"
            aria-expanded={showDatePicker}
            aria-haspopup="dialog"
            onClick={() => { setPickerYear(''); setPickerMonth(''); setPickerDay(''); setPickerAnnouncement(''); setShowDatePicker(v => !v) }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', border: '1px solid #ccc', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="1" y="3" width="14" height="12" rx="2" stroke="#555" strokeWidth="1.4" fill="none"/>
              <path d="M1 7h14" stroke="#555" strokeWidth="1.4"/>
              <path d="M5 1v3M11 1v3" stroke="#555" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            Go to date
          </button>

          {showDatePicker && (
            <div
              role="dialog"
              aria-label="Go to a specific date"
              aria-modal="true"
              style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 300, background: '#fff', border: '1px solid #ddd', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', padding: 20, width: 270 }}
            >
              <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: '#333' }}>Go to date</h3>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 2 }}>
                  <label htmlFor="picker-year" style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 4 }}>Year</label>
                  <input id="picker-year" autoFocus type="text" inputMode="numeric" placeholder="2026" value={pickerYear}
                    onChange={e => setPickerYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    onKeyDown={e => { if (e.key === 'Escape') setShowDatePicker(false); if (e.key === 'Enter') navigateToDate() }}
                    style={{ width: '100%', padding: '7px 8px', border: '1px solid #ccc', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="picker-month" style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 4 }}>Month</label>
                  <input id="picker-month" type="text" inputMode="numeric" placeholder="07" value={pickerMonth}
                    onChange={e => setPickerMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
                    onKeyDown={e => { if (e.key === 'Escape') setShowDatePicker(false); if (e.key === 'Enter') navigateToDate() }}
                    style={{ width: '100%', padding: '7px 8px', border: '1px solid #ccc', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="picker-day" style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 4 }}>Day</label>
                  <input id="picker-day" type="text" inputMode="numeric" placeholder="13" value={pickerDay}
                    onChange={e => setPickerDay(e.target.value.replace(/\D/g, '').slice(0, 2))}
                    onKeyDown={e => { if (e.key === 'Escape') setShowDatePicker(false); if (e.key === 'Enter') navigateToDate() }}
                    style={{ width: '100%', padding: '7px 8px', border: '1px solid #ccc', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }} />
                </div>
              </div>
              <button
                onClick={navigateToDate}
                disabled={!pickerYear || !pickerMonth || !pickerDay}
                style={{ width: '100%', padding: '9px', background: TEAL, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: (!pickerYear || !pickerMonth || !pickerDay) ? 0.4 : 1 }}
              >Go</button>
            </div>
          )}
        </div>
      </nav>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <main
          id="day-grid"
          tabIndex={-1}
          aria-label={`Schedule for ${practitioner}, ${formatDay(currentDay)}`}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', outline: 'none' }}
        >
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ background: '#fff', border: '1px solid #e2e2e2', borderRadius: 4, margin: 14 }}>

              {/* Date header */}
              <div
                ref={dateHeaderRef}
                tabIndex={0}
                aria-label={`${isToday ? 'Today' : formatDayShort(currentDay)}, ${currentDay.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}
                style={{ padding: '10px 14px', borderBottom: '1px solid #e8e8e8' }}
              >
                <span style={{ fontWeight: 700, fontSize: 13, color: '#E8A33D' }}>
                  {isToday ? 'Today' : formatDayShort(currentDay)}, {currentDay.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
              </div>

              {/* Practitioner header */}
              <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', borderBottom: '1px solid #e2e2e2' }}>
                <div />
                <div style={{ borderLeft: '1px solid #e2e2e2', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
                  <div aria-hidden="true" style={{ width: 28, height: 28, borderRadius: '50%', background: TEAL, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>SL</div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: TEAL }}>{practitioner}</span>
                </div>
              </div>

              {/* Grid */}
              <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '60px 1fr' }}>

                {/* Time labels */}
                <div aria-hidden="true">
                  {HOURS.map(h => (
                    <div key={h} style={{ height: ROW_HEIGHT, borderBottom: '1px solid #f0f0f0', padding: '4px 6px', boxSizing: 'border-box' }}>
                      <span style={{ color: '#888', fontSize: 11 }}>{formatHour(h)}</span>
                    </div>
                  ))}
                </div>

                {/* Schedule column */}
                <div style={{ position: 'relative', borderLeft: '1px solid #e2e2e2' }}>
                  <div aria-hidden="true">
                    {HOURS.map(h => (
                      <div key={h} style={{ height: ROW_HEIGHT, borderBottom: '1px solid #f0f0f0' }} />
                    ))}
                  </div>

                  {/* Shift indicator */}
                  <div aria-hidden="true" style={{ position: 'absolute', top: (SHIFT_START - HOUR_START) * ROW_HEIGHT, height: (SHIFT_END - SHIFT_START) * ROW_HEIGHT, left: 0, right: 0, background: 'rgba(91,188,189,0.05)', borderTop: '2px solid rgba(91,188,189,0.3)', borderBottom: '2px solid rgba(91,188,189,0.3)', pointerEvents: 'none', zIndex: 0 }} />

                  {/* Visual focus highlight */}
                  {focusedRange && (
                    <div aria-hidden="true" style={{ position: 'absolute', top: (focusedRange.startHour - HOUR_START) * ROW_HEIGHT, height: (focusedRange.endHour - focusedRange.startHour) * ROW_HEIGHT - 1, left: 0, right: 0, background: '#e0f5f4', outline: `2px solid ${TEAL}`, outlineOffset: -2, borderRadius: 2, pointerEvents: 'none', zIndex: 2 }} />
                  )}

                  {/* Visual booked blocks */}
                  {Object.entries(booked).map(([slot, appt]) => {
                    const s = slotToHour(slot)
                    const dur = durationHours(appt.treatment)
                    const ci = colorMap[slot] ?? 0
                    return (
                      <div key={slot} aria-hidden="true" style={{ position: 'absolute', top: (s - HOUR_START) * ROW_HEIGHT, height: dur * ROW_HEIGHT - 2, left: 2, right: 2, background: apptColors[ci], color: apptColorText[ci], borderRadius: 3, padding: '5px 8px', fontSize: 11, lineHeight: 1.3, overflow: 'hidden', pointerEvents: 'none', zIndex: 1 }}>
                        <div style={{ fontWeight: 700 }}>{formatHour(s)} – {formatHour(s + dur)}</div>
                        <div>{appt.patient}</div>
                        <div style={{ opacity: 0.8 }}>{appt.treatment}</div>
                      </div>
                    )
                  })}

                  {/* Accessible overlay buttons */}
                  {gridItems.map((item) => {
                    if (item.kind === 'booked') {
                      return (
                        <button
                          key={`booked-${item.startHour}`}
                          aria-label={`${formatHour(item.startHour)} to ${formatHour(item.endHour)}, booked: ${item.patient}, ${item.treatment}`}
                          style={{ position: 'absolute', top: (item.startHour - HOUR_START) * ROW_HEIGHT, height: (item.endHour - item.startHour) * ROW_HEIGHT, left: 0, right: 0, opacity: 0, zIndex: 3, border: 'none', background: 'none', cursor: 'default', padding: 0 }}
                          onFocus={() => setFocusedRange({ startHour: item.startHour, endHour: item.endHour })}
                          onBlur={() => setFocusedRange(null)}
                        />
                      )
                    }

                    const segments: { startHour: number; endHour: number; inShift: boolean }[] = []
                    const s = item.startHour, e = item.endHour
                    if (s < SHIFT_START) segments.push({ startHour: s, endHour: Math.min(e, SHIFT_START), inShift: false })
                    if (s < SHIFT_END && e > SHIFT_START) segments.push({ startHour: Math.max(s, SHIFT_START), endHour: Math.min(e, SHIFT_END), inShift: true })
                    if (e > SHIFT_END) segments.push({ startHour: Math.max(s, SHIFT_END), endHour: e, inShift: false })

                    return segments.map((seg, si) => {
                      const label = seg.inShift
                        ? `${formatHour(seg.startHour)} to ${formatHour(seg.endHour)}, available. Press Enter to book.`
                        : `${formatHour(seg.startHour)} to ${formatHour(seg.endHour)}, available but outside shift hours. Press Enter to book anyway.`
                      return (
                        <button
                          key={`avail-${item.startHour}-${si}`}
                          aria-label={label}
                          style={{ position: 'absolute', top: (seg.startHour - HOUR_START) * ROW_HEIGHT, height: (seg.endHour - seg.startHour) * ROW_HEIGHT - 1, left: 2, right: 2, background: 'transparent', border: 'none', zIndex: 3, cursor: 'pointer', padding: 0, borderRadius: 2 }}
                          onClick={() => {
                            activeSlotRef.current = document.activeElement as HTMLButtonElement
                            handleSlotClick(seg.startHour, seg.endHour)
                          }}
                          onFocus={() => setFocusedRange({ startHour: seg.startHour, endHour: seg.endHour })}
                          onBlur={() => setFocusedRange(null)}
                        />
                      )
                    })
                  })}
                </div>
              </div>
            </div>
          </div>
        </main>

        {confirmedAppt && (
          <ConfirmedPanel
            patient={confirmedAppt.patient}
            treatment={confirmedAppt.treatment}
            startHour={confirmedAppt.startHour}
            endHour={confirmedAppt.endHour}
            practitioner={practitioner}
            date={currentDay}
            onClose={() => setConfirmedAppt(null)}
          />
        )}
      </div>

      {bookingHour !== null && (
        <BookingPanel
          practitioner={practitioner}
          startHour={bookingHour}
          availableUntil={bookingAvailableUntil ?? HOUR_END}
          date={currentDay}
          bookedRanges={bookedRanges}
          onClose={() => { setBookingHour(null); setTimeout(() => dateHeaderRef.current?.focus(), 100) }}
          onBook={handleBook}
          onOverlapClose={() => { setBookingHour(null); setTimeout(() => dateHeaderRef.current?.focus(), 100) }}
          triggerRef={activeSlotRef}
        />
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
 *  App root
 * ───────────────────────────────────────────────────────────────── */

export default function App() {
  return (
    <BurritoProvider>
      <DayView />
    </BurritoProvider>
  )
}

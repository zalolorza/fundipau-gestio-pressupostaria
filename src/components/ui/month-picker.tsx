"use client"

import * as React from "react"
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { formatMonth } from "@/lib/format"

const MONTH_LABELS = [
  "Gen",
  "Feb",
  "Març",
  "Abr",
  "Maig",
  "Juny",
  "Jul",
  "Ago",
  "Set",
  "Oct",
  "Nov",
  "Des",
] as const

function normalizeMonth(value: string): string {
  return value.slice(0, 7)
}

function monthToDate(value: string): string {
  return `${normalizeMonth(value)}-01`
}

type MonthPickerProps = {
  id?: string
  name?: string
  value?: string
  defaultValue?: string
  required?: boolean
  disabled?: boolean
  className?: string
  placeholder?: string
  "aria-label"?: string
  onChange?: (value: string) => void
}

function MonthPicker({
  id,
  name,
  value: valueProp,
  defaultValue = "",
  required,
  disabled,
  className,
  placeholder = "Tria un mes",
  "aria-label": ariaLabel,
  onChange,
}: MonthPickerProps) {
  const [open, setOpen] = React.useState(false)
  const [uncontrolled, setUncontrolled] = React.useState(
    defaultValue ? normalizeMonth(defaultValue) : ""
  )
  const isControlled = valueProp !== undefined
  const value = isControlled ? (valueProp ? normalizeMonth(valueProp) : "") : uncontrolled

  const initialYear = value
    ? Number(value.slice(0, 4))
    : new Date().getFullYear()
  const [year, setYear] = React.useState(initialYear)

  React.useEffect(() => {
    if (open) setYear(value ? Number(value.slice(0, 4)) : new Date().getFullYear())
  }, [open, value])

  const setValue = (next: string) => {
    if (!isControlled) setUncontrolled(next)
    onChange?.(next)
  }

  return (
    <div className={cn("relative", className)}>
      {name ? (
        <input
          type="text"
          name={name}
          value={value}
          required={required}
          tabIndex={-1}
          aria-hidden
          readOnly
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          onFocus={() => setOpen(true)}
        />
      ) : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-label={ariaLabel}
            aria-required={required || undefined}
            className={cn(
              "w-full justify-start border-input font-normal",
              !value && "text-muted-foreground"
            )}
          >
            <CalendarIcon data-icon="inline-start" />
            {value ? formatMonth(monthToDate(value)) : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 gap-3 p-3">
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Any anterior"
              onClick={() => setYear((y) => y - 1)}
            >
              <ChevronLeftIcon />
            </Button>
            <span className="text-sm font-medium tabular-nums">{year}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Any següent"
              onClick={() => setYear((y) => y + 1)}
            >
              <ChevronRightIcon />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTH_LABELS.map((label, index) => {
              const monthValue = `${year}-${String(index + 1).padStart(2, "0")}`
              return (
                <Button
                  key={label}
                  type="button"
                  variant={value === monthValue ? "default" : "ghost"}
                  size="sm"
                  className="font-normal"
                  onClick={() => {
                    setValue(monthValue)
                    setOpen(false)
                  }}
                >
                  {label}
                </Button>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export { MonthPicker }

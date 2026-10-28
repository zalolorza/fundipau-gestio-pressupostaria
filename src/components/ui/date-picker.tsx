"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { formatDate } from "@/lib/format"

function parseISODate(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return undefined
  const [y, m, d] = value.slice(0, 10).split("-").map(Number)
  const date = new Date(y, m - 1, d)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function toISODate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-")
}

type DatePickerProps = {
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

function DatePicker({
  id,
  name,
  value: valueProp,
  defaultValue = "",
  required,
  disabled,
  className,
  placeholder = "Tria una data",
  "aria-label": ariaLabel,
  onChange,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue)
  const isControlled = valueProp !== undefined
  const value = isControlled ? valueProp : uncontrolled

  const setValue = (next: string) => {
    if (!isControlled) setUncontrolled(next)
    onChange?.(next)
  }

  const selected = value ? parseISODate(value) : undefined

  return (
    <div className="relative">
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
              !value && "text-muted-foreground",
              className
            )}
          >
            <CalendarIcon data-icon="inline-start" />
            {value ? formatDate(value) : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={(date) => {
              if (!date) return
              setValue(toISODate(date))
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

export { DatePicker }

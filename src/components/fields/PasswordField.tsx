'use client'

import {
  IconButton,
  Input,
  InputGroup,
  InputProps,
  InputRightElement,
  useColorModeValue,
} from '@chakra-ui/react'
import { useId, useState } from 'react'
import { MdOutlineRemoveRedEye } from 'react-icons/md'
import { RiEyeCloseLine } from 'react-icons/ri'

type PasswordFieldProps = Omit<InputProps, 'type'> & {
  /**
   * `current-password` on sign-in, `new-password` on registration.
   *
   * Required rather than defaulted: getting it wrong makes a password manager
   * offer to overwrite a stored credential on a login form, or offer the old
   * one on a registration form. The right answer differs per screen, so the
   * screen says it.
   */
  autoComplete: 'current-password' | 'new-password'
}

/**
 * A password input with a reveal toggle.
 *
 * Shared by login and register because the interesting part is not the markup,
 * it is the behaviour — and behaviour duplicated across two files is behaviour
 * that will only get fixed in one of them.
 *
 * The toggle is a real `<button>`, which the previous version was not: it was
 * an `<svg>` with an onClick, so it could not be reached by keyboard at all
 * and its aria-label sat on an element nothing could focus. Anyone typing a
 * password without a mouse simply had no way to check what they typed.
 */
export function PasswordField({ autoComplete, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  const inputId = useId()

  const iconColor = useColorModeValue('gray.400', 'whiteAlpha.600')
  const iconHover = useColorModeValue('gray.600', 'white')
  const focusRing = useColorModeValue('brand.500', 'brand.400')

  const label = visible ? 'Sembunyikan password' : 'Tampilkan password'
  const Eye = visible ? RiEyeCloseLine : MdOutlineRemoveRedEye

  // InputGroup lg, bukan md. Selama Input di dalamnya membawa size="lg"
  // sendiri, md di sini tidak pernah berlaku -- sekarang size datang dari tema,
  // jadi pembungkusnya yang menentukan, dan md akan mengecilkan field-nya.
  return (
    <InputGroup size="lg">
      <Input
        id={inputId}
        // The whole point: flipping this is what reveals the value.
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        // Room for the button, so a long password never runs underneath it.
        pe="48px"
        {...props}
      />
      <InputRightElement w="48px" h="100%" display="flex" alignItems="center" justifyContent="center">
        <IconButton
          // type="button" is load-bearing: a <button> inside a <form>
          // defaults to submit, so without this, revealing the password would
          // submit the form instead.
          type="button"
          aria-label={label}
          // A toggle button, so a screen reader announces the state rather
          // than only the action taken.
          aria-pressed={visible}
          aria-controls={inputId}
          icon={<Eye />}
          onClick={() => setVisible((v) => !v)}
          variant="ghost"
          size="sm"
          // 36px inside a 48px lane: big enough to hit on a phone without
          // crowding the text it sits beside.
          minW="36px"
          h="36px"
          borderRadius="8px"
          color={iconColor}
          _hover={{ color: iconHover, bg: 'transparent' }}
          _active={{ bg: 'transparent' }}
          // Keyboard users need to see where they are. The icon alone gives no
          // hint, and the default Chakra ring is easy to lose on this input.
          _focusVisible={{ outline: '2px solid', outlineColor: focusRing, outlineOffset: '1px' }}
        />
      </InputRightElement>
    </InputGroup>
  )
}

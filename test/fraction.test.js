import { describe, test, expect } from 'bun:test'
import Fraction from '../src/fraction.js'

describe('Fraction', () => {
	describe('constructor', () => {
		test('creates fraction with numerator and denominator', () => {
			const f = new Fraction(3, 4)
			expect(f.numerator).toBe(3)
			expect(f.denominator).toBe(4)
		})

		test('defaults to 1/1 when no args', () => {
			const f = new Fraction()
			expect(f.numerator).toBe(1)
			expect(f.denominator).toBe(1)
		})
	})

	describe('value', () => {
		test('returns decimal value', () => {
			expect(new Fraction(1, 2).value()).toBe(0.5)
			expect(new Fraction(3, 4).value()).toBe(0.75)
			expect(new Fraction(1, 4).value()).toBe(0.25)
		})
	})

	describe('simplify', () => {
		test('reduces fraction to lowest terms', () => {
			const f = new Fraction(4, 8).simplify()
			expect(f.numerator).toBe(1)
			expect(f.denominator).toBe(2)
		})

		test('handles negative denominator', () => {
			const f = new Fraction(1, -2).simplify()
			expect(f.numerator).toBe(-1)
			expect(f.denominator).toBe(2)
		})
	})

	describe('add', () => {
		test('adds two fractions', () => {
			const f = new Fraction(1, 4).add(new Fraction(1, 4))
			expect(f.value()).toBe(0.5)
		})

		test('adds fraction with different denominators', () => {
			const f = new Fraction(1, 2).add(new Fraction(1, 4))
			expect(f.value()).toBe(0.75)
		})
	})

	describe('multiply', () => {
		test('multiplies two fractions', () => {
			const f = new Fraction(1, 2).multiply(new Fraction(1, 2))
			expect(f.value()).toBe(0.25)
		})

		test('multiplies with numbers', () => {
			const f = new Fraction(1, 4).multiply(3, 2)
			expect(f.numerator).toBe(3)
			expect(f.denominator).toBe(8)
		})
	})

	describe('clone', () => {
		test('creates independent copy', () => {
			const f1 = new Fraction(1, 2)
			const f2 = f1.clone()
			f1.set(3, 4)
			expect(f2.numerator).toBe(1)
			expect(f2.denominator).toBe(2)
		})
	})

	describe('GCD', () => {
		test('finds greatest common divisor', () => {
			expect(Fraction.GCD(12, 8)).toBe(4)
			expect(Fraction.GCD(17, 5)).toBe(1)
		})
	})

	describe('LCM', () => {
		test('finds lowest common multiple', () => {
			expect(Fraction.LCM(4, 6)).toBe(12)
			expect(Fraction.LCM(3, 5)).toBe(15)
		})
	})
})

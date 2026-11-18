import type {Fragment, Node as PMNode, Slice} from '@tiptap/pm/model'

// Plain text for the clipboard which keeps the structure readable when pasted
// into a text-only target: list markers, task checkboxes, quotes and table cells.

function leafText(node: PMNode): string {
	switch (node.type.name) {
		case 'hardBreak':
			return '\n'
		case 'taskLink':
			return node.attrs.href ?? ''
		case 'image':
			return node.attrs.alt ?? ''
		case 'mention':
			return '@' + (node.attrs.label ?? node.attrs.id ?? '')
	}
	const fromSpec = node.type.spec.leafText?.(node)
	if (typeof fromSpec === 'string') {
		return fromSpec
	}
	return node.isText ? (node.text ?? '') : ''
}

function inlineText(node: PMNode): string {
	return node.textBetween(0, node.content.size, '\n', leafText)
}

function prefixLines(text: string, first: string, rest: string): string {
	return text
		.split('\n')
		.map((line, i) => (i === 0 ? first : rest) + line)
		.join('\n')
}

function serializeList(node: PMNode, marker: (item: PMNode, index: number) => string): string {
	const items: string[] = []
	node.forEach((item, _offset, index) => {
		const prefix = marker(item, index)
		const content = serializeFragment(item.content, '\n')
		items.push(prefixLines(content, prefix, ' '.repeat(prefix.length)))
	})
	return items.join('\n')
}

function serializeBlock(node: PMNode): string {
	if (node.isInline) {
		return leafText(node)
	}

	switch (node.type.name) {
		case 'bulletList':
			return serializeList(node, () => '- ')
		case 'orderedList': {
			const start = typeof node.attrs.start === 'number' ? node.attrs.start : 1
			return serializeList(node, (_item, index) => `${start + index}. `)
		}
		case 'taskList':
			return serializeList(node, item => item.attrs.checked ? '- [x] ' : '- [ ] ')
		case 'listItem':
		case 'taskItem':
			return serializeFragment(node.content, '\n')
		case 'blockquote':
			return prefixLines(serializeFragment(node.content, '\n\n'), '> ', '> ')
		case 'codeBlock':
			return node.textContent
		case 'horizontalRule':
			return '---'
		case 'table': {
			const rows: string[] = []
			node.forEach(row => {
				const cells: string[] = []
				row.forEach(cell => cells.push(serializeFragment(cell.content, ' ')))
				rows.push(cells.join('\t'))
			})
			return rows.join('\n')
		}
	}

	if (node.isTextblock) {
		return inlineText(node)
	}

	if (node.isLeaf) {
		return leafText(node)
	}

	return serializeFragment(node.content, '\n\n')
}

function serializeFragment(fragment: Fragment, blockSeparator: string): string {
	const parts: string[] = []
	let inline = ''
	fragment.forEach(child => {
		if (child.isInline) {
			inline += leafText(child)
			return
		}
		if (inline !== '') {
			parts.push(inline)
			inline = ''
		}
		parts.push(serializeBlock(child))
	})
	if (inline !== '') {
		parts.push(inline)
	}
	return parts.join(blockSeparator)
}

export function serializeSliceAsText(slice: Slice): string {
	return serializeFragment(slice.content, '\n\n')
}

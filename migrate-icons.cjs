/**
 * Script de Migración de Iconos - Fase 2
 * Maneja casos especiales: dinámicos, multi-línea, y variantes ternarias
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'src');
const SKIP_FILES = ['Icon.jsx'];

function getJSXFiles(dir) {
    const results = [];
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            results.push(...getJSXFiles(fullPath));
        } else if (item.endsWith('.jsx') && !SKIP_FILES.includes(item)) {
            results.push(fullPath);
        }
    }
    return results;
}

function convertSizeClasses(cls) {
    return cls
        .replace(/!?text-\[(\d+)px\]/g, (_, px) => `!w-[${px}] !h-[${px}]`)
        .replace(/!?text-5xl/g, '!w-12 !h-12')
        .replace(/!?text-4xl/g, '!w-10 !h-10')
        .replace(/!?text-3xl/g, '!w-8 !h-8')
        .replace(/!?text-2xl/g, '!w-6 !h-6')
        .replace(/!?text-xl/g, '!w-5 !h-5')
        .replace(/!?text-lg/g, '!w-5 !h-5')
        .replace(/!?text-base/g, '!w-4 !h-4')
        .replace(/!?text-sm/g, '!w-4 !h-4')
        .replace(/!?text-\[18px\]/g, '!w-[18px] !h-[18px]')
        .replace(/!?text-\[17px\]/g, '!w-[17px] !h-[17px]')
        .replace(/!?text-\[20px\]/g, '!w-5 !h-5')
        .replace(/!?text-\[16px\]/g, '!w-4 !h-4')
        .replace(/!?text-\[28px\]/g, '!w-7 !h-7')
        .replace(/\s*font-black/g, '')
        .replace(/\s*font-bold/g, '')
        .replace(/\s*font-medium/g, '')
        .replace(/\s*font-normal/g, '')
        .replace(/\s*font-light/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractExtraClasses(fullClassName) {
    let extra = fullClassName
        .replace(/material-symbols-outlined/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    return convertSizeClasses(extra);
}

function buildIconTag(nameExpr, classStr, isDynamic) {
    const extraClasses = extractExtraClasses(classStr || '');
    const nameAttr = isDynamic ? `name={${nameExpr}}` : `name="${nameExpr}"`;
    const classAttr = extraClasses ? ` className="${extraClasses}"` : '';
    return `<Icon ${nameAttr}${classAttr} />`;
}

let totalReplaced = 0;
let filesModified = 0;

const files = getJSXFiles(SRC_DIR);

for (const filePath of files) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Only process files that still have the font class
    if (!content.includes('material-symbols-outlined')) continue;

    const originalContent = content;
    const fileName = path.basename(filePath);
    let replacements = 0;

    // ── Strategy: work on the full string with a combined regex ──────────────
    // Match the opening tag + everything between > and </span>
    // We use [^]* (any char incl newlines) to handle multi-line cases
    // but limit to avoid runaway matches with a non-greedy version

    // Pattern: <span className="...material-symbols-outlined...">\n?  CONTENT  \n?</span>
    // where CONTENT can be a literal icon name OR a dynamic expression
    const spanRegex = /<span\s+className=["'{`]([^'"}`]*material-symbols-outlined[^'"}`]*)["'{`][^>]*>\s*([\s\S]*?)\s*<\/span>/g;

    content = content.replace(spanRegex, (full, classStr, innerContent) => {
        const trimmed = innerContent.trim();

        // Dynamic: {expr}
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            const expr = trimmed.slice(1, -1);
            const extra = extractExtraClasses(classStr);
            replacements++;
            totalReplaced++;
            const classAttr = extra ? ` className="${extra}"` : '';
            return `<Icon name={${expr}}${classAttr} />`;
        }

        // Literal icon name (no spaces, no special chars except _ )
        if (/^[a-z_0-9]+$/.test(trimmed)) {
            const extra = extractExtraClasses(classStr);
            replacements++;
            totalReplaced++;
            const classAttr = extra ? ` className="${extra}"` : '';
            return `<Icon name="${trimmed}"${classAttr} />`;
        }

        // Unknown pattern — leave untouched and log
        console.log(`  ⚠ Skipped complex pattern in ${fileName}: ${trimmed.substring(0, 60)}`);
        return full;
    });

    // Also handle template literal className: className={`material-symbols-outlined ${...}`}
    const templateRegex = /<span\s+className=\{`([^`]*material-symbols-outlined[^`]*)`\}\s*>\s*([\s\S]*?)\s*<\/span>/g;
    content = content.replace(templateRegex, (full, classTemplate, innerContent) => {
        const trimmed = innerContent.trim();
        const staticParts = classTemplate.replace(/\$\{[^}]+\}/g, '').replace(/material-symbols-outlined/g, '').replace(/\s+/g, ' ').trim();
        const dynamicParts = [];
        const dynRegex = /\$\{([^}]+)\}/g;
        let m;
        while ((m = dynRegex.exec(classTemplate)) !== null) {
            dynamicParts.push(m[1]);
        }

        const sizePart = convertSizeClasses(staticParts);

        let classAttr = '';
        if (sizePart && dynamicParts.length > 0) {
            classAttr = ` className={\`${sizePart} \${${dynamicParts.join(' ')}}\`}`;
        } else if (sizePart) {
            classAttr = ` className="${sizePart}"`;
        } else if (dynamicParts.length > 0) {
            classAttr = ` className={${dynamicParts.join(' ')}}`;
        }

        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            const expr = trimmed.slice(1, -1);
            replacements++;
            totalReplaced++;
            return `<Icon name={${expr}}${classAttr} />`;
        }
        if (/^[a-z_0-9]+$/.test(trimmed)) {
            replacements++;
            totalReplaced++;
            return `<Icon name="${trimmed}"${classAttr} />`;
        }
        return full;
    });

    if (replacements > 0) {
        // Ensure Icon import
        if (!content.includes("import Icon from")) {
            content = content.replace(
                /^(import .+from .+;?\r?\n)/m,
                `$1import Icon from '../components/Icon';\n`
            );
            const relativePath = path.relative(SRC_DIR, filePath);
            if (relativePath.startsWith('components')) {
                content = content.replace(
                    "import Icon from '../components/Icon';",
                    "import Icon from './Icon';"
                );
            }
        }

        fs.writeFileSync(filePath, content, 'utf8');
        filesModified++;
        console.log(`✓ ${fileName}: ${replacements} icon(s) migrated`);
    } else if (content.includes('material-symbols-outlined')) {
        console.log(`⚠ ${fileName}: still has material-symbols — check manually`);
    }
}

console.log(`\n=== DONE ===`);
console.log(`Files modified: ${filesModified}`);
console.log(`Total icons migrated: ${totalReplaced}`);

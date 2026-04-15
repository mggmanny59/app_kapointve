/**
 * Script de Migración de Iconos
 * Reemplaza <span className="...material-symbols-outlined...">icon_name</span>
 * con <Icon name="icon_name" className="..." /> en todos los archivos JSX
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'src');

// Archivos que NO debemos modificar el fallback
const SKIP_FILES = ['Icon.jsx'];

// Obtener todos los archivos JSX recursivamente
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

// Convierte className de text-size a w/h equivalente para SVG
function convertTextSizeToWH(className) {
    // Material symbols usa text-xl, !text-2xl, etc. para tamaño
    // Las convertimos en clases w/h para SVG
    return className
        .replace(/!?text-\[(\d+)px\]/g, (_, px) => {
            const num = parseInt(px);
            return `!w-[${px}] !h-[${px}]`;
        })
        .replace(/!?text-4xl/g, '!w-10 !h-10')
        .replace(/!?text-5xl/g, '!w-12 !h-12')
        .replace(/!?text-3xl/g, '!w-8 !h-8')
        .replace(/!?text-2xl/g, '!w-6 !h-6')
        .replace(/!?text-xl/g, '!w-5 !h-5')
        .replace(/!?text-lg/g, '!w-5 !h-5')
        .replace(/!?text-base/g, '!w-4 !h-4')
        .replace(/!?text-sm/g, '!w-4 !h-4')
        .replace(/!?text-\[18px\]/g, '!w-[18px] !h-[18px]')
        .replace(/!?text-\[20px\]/g, '!w-5 !h-5')
        .replace(/!?text-\[28px\]/g, '!w-7 !h-7')
        // Remove font-black, font-bold, font-medium (no aplica a SVG)
        .replace(/\s*font-black/g, '')
        .replace(/\s*font-bold/g, '')
        .replace(/\s*font-medium/g, '')
        .replace(/\s*font-normal/g, '')
        .trim();
}

// Extrae la className "extra" quitando la parte de material-symbols-outlined
function extractExtraClasses(fullClassName) {
    // Quitar la clase base y variantes de tamaño de texto
    let extra = fullClassName
        .replace(/material-symbols-outlined/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    
    return convertTextSizeToWH(extra);
}

let totalReplaced = 0;
let filesModified = 0;

const files = getJSXFiles(SRC_DIR);

for (const filePath of files) {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    const fileName = path.basename(filePath);

    // Pattern 1: <span className="material-symbols-outlined [extra-classes]">icon_name</span>
    // Con className como string literal
    const pattern1 = /<span\s+className="([^"]*material-symbols-outlined[^"]*)"\s*>([^{<\n]+?)<\/span>/g;
    let match;
    let replacements = 0;

    content = content.replace(pattern1, (full, classStr, iconName) => {
        const trimmedIcon = iconName.trim();
        // Skip dynamic icon names
        if (trimmedIcon.startsWith('{')) return full;
        
        const extraClasses = extractExtraClasses(classStr);
        replacements++;
        totalReplaced++;
        
        if (extraClasses) {
            return `<Icon name="${trimmedIcon}" className="${extraClasses}" />`;
        } else {
            return `<Icon name="${trimmedIcon}" />`;
        }
    });

    // Pattern 2: <span className={"material-symbols-outlined [extra]"}>icon</span>
    const pattern2 = /<span\s+className=\{"([^"]*material-symbols-outlined[^"]*)"\}\s*>([^{<\n]+?)<\/span>/g;
    content = content.replace(pattern2, (full, classStr, iconName) => {
        const trimmedIcon = iconName.trim();
        if (trimmedIcon.startsWith('{')) return full;
        
        const extraClasses = extractExtraClasses(classStr);
        replacements++;
        totalReplaced++;
        
        if (extraClasses) {
            return `<Icon name="${trimmedIcon}" className="${extraClasses}" />`;
        } else {
            return `<Icon name="${trimmedIcon}" />`;
        }
    });

    // Pattern 3: <span className={`material-symbols-outlined ${...}`}>icon</span>
    // Template literal con clase base fija - misma lógica pero más compleja
    const pattern3 = /<span\s+className=\{`([^`]*material-symbols-outlined[^`]*)`\}\s*>([^{<\n]+?)<\/span>/g;
    content = content.replace(pattern3, (full, classTemplate, iconName) => {
        const trimmedIcon = iconName.trim();
        if (trimmedIcon.startsWith('{')) return full;

        // Extraer las partes estáticas del template
        const staticParts = classTemplate.replace(/\$\{[^}]+\}/g, ' ').replace(/material-symbols-outlined/g, '').trim();
        const extraClasses = convertTextSizeToWH(staticParts.replace(/\s+/g, ' ').trim());
        
        // Extraer las partes dinámicas
        const dynamicParts = [];
        const dynRegex = /\$\{([^}]+)\}/g;
        let dynMatch;
        while ((dynMatch = dynRegex.exec(classTemplate)) !== null) {
            dynamicParts.push(dynMatch[1]);
        }

        replacements++;
        totalReplaced++;

        let classNameAttr = '';
        if (extraClasses && dynamicParts.length > 0) {
            classNameAttr = `className={\`${extraClasses} \${${dynamicParts.join(' ')}}\`}`;
        } else if (extraClasses) {
            classNameAttr = `className="${extraClasses}"`;
        } else if (dynamicParts.length > 0) {
            classNameAttr = `className={${dynamicParts.join(' ')}}`;
        }

        return `<Icon name="${trimmedIcon}" ${classNameAttr} />`;
    });

    // Check if Icon is imported - if not, add it
    if (replacements > 0 && content !== originalContent) {
        const hasIconImport = /import\s+Icon\s+from/.test(content);
        if (!hasIconImport) {
            // Find the first import line and add after it
            content = content.replace(
                /^(import .+from .+;?\r?\n)/m,
                `$1import Icon from '../components/Icon';\n`
            );
            // Fix if we're already in components dir - use ./Icon
            const relativePath = path.relative(SRC_DIR, filePath);
            if (relativePath.startsWith('components')) {
                content = content.replace(
                    "import Icon from '../components/Icon';",
                    "import Icon from './Icon';"
                );
            }
            console.log(`  + Added Icon import to ${fileName}`);
        }

        fs.writeFileSync(filePath, content, 'utf8');
        filesModified++;
        console.log(`✓ ${fileName}: ${replacements} icon(s) migrated`);
    } else if (replacements === 0 && content.includes('material-symbols-outlined')) {
        console.log(`⚠ ${fileName}: has material-symbols but pattern didn't match (manual review needed)`);
    }
}

console.log(`\n=== DONE ===`);
console.log(`Files modified: ${filesModified}`);
console.log(`Total icons migrated: ${totalReplaced}`);

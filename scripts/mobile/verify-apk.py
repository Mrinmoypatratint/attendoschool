"""Verify the launcher is a defined DEX class, not just a manifest reference."""
import re
import struct
import sys
import zipfile


def integer(data, offset):
    return struct.unpack_from('<I', data, offset)[0]


def defined_classes(data):
    string_table = integer(data, 60)
    type_table = integer(data, 68)
    count, table = integer(data, 96), integer(data, 100)
    for i in range(count):
        type_index = integer(data, table + 32 * i)
        string_index = integer(data, type_table + 4 * type_index)
        offset = integer(data, string_table + 4 * string_index)
        # Skip the ULEB128 UTF-16 character count before the MUTF-8 descriptor.
        while data[offset] & 0x80:
            offset += 1
        offset += 1
        end = data.index(b'\0', offset)
        yield data[offset:end].decode('utf-8')


with zipfile.ZipFile(sys.argv[1]) as apk:
    launcher = 'Lonline/attendoschool/app/MainActivity;'
    found = any(
        launcher in set(defined_classes(apk.read(name)))
        for name in apk.namelist() if re.fullmatch(r'classes\d*\.dex', name)
    )
    if not found:
        raise SystemExit('Invalid APK: the declared Android launcher MainActivity is missing from DEX.')
print('Verified: MainActivity is defined in the packaged APK.')
